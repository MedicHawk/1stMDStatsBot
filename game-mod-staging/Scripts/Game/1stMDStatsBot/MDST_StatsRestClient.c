//------------------------------------------------------------------------------------------------
//! Thin REST client for the 1stMD backend.
//! Bohemia REST docs note requests are asynchronous and callback lifetime is the script author's job,
//! so this class keeps callback and context references alive for the component lifetime.
//------------------------------------------------------------------------------------------------

class MDST_StatsRestCallback : RestCallback
{
	protected string m_sEndpoint;

	void MDST_StatsRestCallback(string endpoint)
	{
		m_sEndpoint = endpoint;
	}

	override void OnError(int errorCode)
	{
		Print(string.Format("[1stMD Stats] REST error endpoint=%1 code=%2", m_sEndpoint, errorCode), LogLevel.WARNING);
	}

	override void OnTimeout()
	{
		Print(string.Format("[1stMD Stats] REST timeout endpoint=%1", m_sEndpoint), LogLevel.WARNING);
	}

	override void OnSuccess(string data, int dataSize)
	{
		Print(string.Format("[1stMD Stats] REST success endpoint=%1 bytes=%2", m_sEndpoint, dataSize), LogLevel.NORMAL);
	}
}

class MDST_KillToastRestCallback : MDST_StatsRestCallback
{
	protected int m_iPlayerId;

	void MDST_KillToastRestCallback(string endpoint, int playerId)
	{
		m_sEndpoint = endpoint;
		m_iPlayerId = playerId;
	}

	override void OnSuccess(string data, int dataSize)
	{
		super.OnSuccess(data, dataSize);

		if (data.IsEmpty())
		{
			Print(string.Format("[1stMD Stats] Kill toast snapshot response empty player_id=%1 endpoint=%2 bytes=%3", m_iPlayerId, m_sEndpoint, dataSize), LogLevel.WARNING);
			return;
		}

		string toastText = DecodeJsonStringResponse(data);
		Print(string.Format("[1stMD Stats] Kill toast snapshot received player_id=%1 bytes=%2 text=%3", m_iPlayerId, dataSize, toastText), LogLevel.NORMAL);
		SCR_PlayerControllerGroupComponent.MDST_ShowKillToastToPlayer(m_iPlayerId, toastText);
	}

	protected string DecodeJsonStringResponse(string data)
	{
		string text = data;
		int length = text.Length();
		if (length >= 2 && text.StartsWith("\"") && text.EndsWith("\""))
			text = text.Substring(1, length - 2);

		text.Replace("\\n", "\n");
		text.Replace("\\r", "");
		text.Replace("\\\"", "\"");
		text.Replace("\\\\", "\\");
		return text;
	}
}

class MDST_QueuedRequest
{
	string m_sEndpoint;
	string m_sJson;
	int m_iAttempts;

	void MDST_QueuedRequest(string endpoint, string json)
	{
		m_sEndpoint = endpoint;
		m_sJson = json;
		m_iAttempts = 0;
	}
}

class MDST_StatsRestClient
{
	protected string m_sApiBaseUrl;
	protected string m_sServerId;
	protected string m_sApiKey;
	protected bool m_bEnabled;

	protected RestContext m_RestContext;
	protected ref array<ref MDST_StatsRestCallback> m_aCallbacks = {};
	protected ref array<ref MDST_QueuedRequest> m_aQueue = {};
	protected int m_iMaxQueuedRequests = 250;
	protected int m_iMaxAttempts = 5;
	protected int m_iDispatchedCount = 0;
	protected int m_iQueuedCount = 0;
	protected int m_iDroppedCount = 0;
	protected int m_iOversizedDroppedCount = 0;
	protected int m_iDispatchFailedCount = 0;

	void Configure(string apiBaseUrl, string serverId, string apiKey, bool enabled)
	{
		m_sApiBaseUrl = apiBaseUrl;
		m_sServerId = serverId;
		m_sApiKey = apiKey;
		m_bEnabled = enabled;

		if (!m_sApiBaseUrl.EndsWith("/"))
			m_sApiBaseUrl += "/";

		Print(string.Format(
			"[1stMD Stats] REST configure enabled=%1 api=%2 server_id=%3 api_key_len=%4",
			m_bEnabled,
			m_sApiBaseUrl,
			m_sServerId,
			m_sApiKey.Length()
		), LogLevel.NORMAL);

		if (!m_bEnabled)
			return;

		if (m_sApiBaseUrl.IsEmpty() || m_sServerId.IsEmpty() || m_sApiKey.IsEmpty())
		{
			Print(string.Format(
				"[1stMD Stats] REST config incomplete api_url_missing=%1 server_id_missing=%2 api_key_missing=%3 api=%4 server_id=%5",
				m_sApiBaseUrl.IsEmpty(),
				m_sServerId.IsEmpty(),
				m_sApiKey.IsEmpty(),
				m_sApiBaseUrl,
				m_sServerId
			), LogLevel.ERROR);
			return;
		}

		BuildContext();
	}

	bool IsReady()
	{
		return m_bEnabled && m_RestContext && !m_sServerId.IsEmpty() && !m_sApiKey.IsEmpty();
	}

	protected void BuildContext()
	{
		m_RestContext = GetGame().GetRestApi().GetContext(m_sApiBaseUrl);
		if (!m_RestContext)
		{
			Print("[1stMD Stats] Failed to create REST context.", LogLevel.ERROR);
			return;
		}

		Print(string.Format("[1stMD Stats] REST context ready api=%1 server_id=%2", m_sApiBaseUrl, m_sServerId), LogLevel.NORMAL);
	}

	protected string BuildAuthenticatedEndpoint(string endpoint)
	{
		return string.Format("%1?server_id=%2&api_key=%3", endpoint, EncodeQueryComponent(m_sServerId), EncodeQueryComponent(m_sApiKey));
	}

	protected string EncodeQueryComponent(string value)
	{
		string encoded = value;
		encoded.Replace("%", "%25");
		encoded.Replace(" ", "%20");
		encoded.Replace("+", "%2B");
		encoded.Replace("&", "%26");
		encoded.Replace("=", "%3D");
		encoded.Replace("?", "%3F");
		encoded.Replace("#", "%23");
		return encoded;
	}

	void Post(string endpoint, string json)
	{
		if (!IsReady())
		{
			Print(string.Format("[1stMD Stats] REST not ready; queueing endpoint=%1 bytes=%2", endpoint, json.Length()), LogLevel.WARNING);
			Queue(endpoint, json);
			return;
		}

		if (json.Length() > 1000000)
		{
			m_iOversizedDroppedCount++;
			m_iDroppedCount++;
			Print(string.Format("[1stMD Stats] Refusing oversized payload endpoint=%1 bytes=%2", endpoint, json.Length()), LogLevel.ERROR);
			return;
		}

		string authenticatedEndpoint = BuildAuthenticatedEndpoint(endpoint);
		MDST_StatsRestCallback callback = new MDST_StatsRestCallback(endpoint);
		m_aCallbacks.Insert(callback);

		Print(string.Format("[1stMD Stats] REST POST dispatch endpoint=%1 bytes=%2 queue_depth=%3", endpoint, json.Length(), m_aQueue.Count()), LogLevel.NORMAL);
		int result = m_RestContext.POST(callback, authenticatedEndpoint, json);
		Print(string.Format("[1stMD Stats] REST POST result endpoint=%1 result=%2", endpoint, result), LogLevel.NORMAL);

		if (result < 0)
		{
			m_iDispatchFailedCount++;
			Print(string.Format("[1stMD Stats] POST dispatch failed endpoint=%1 result=%2", endpoint, result), LogLevel.WARNING);
			Queue(endpoint, json);
			return;
		}

		m_iDispatchedCount++;
	}

	void PostWithKillToast(string endpoint, string json, int playerId)
	{
		if (!IsReady())
		{
			Print(string.Format("[1stMD Stats] REST not ready; queueing endpoint=%1 bytes=%2", endpoint, json.Length()), LogLevel.WARNING);
			Queue(endpoint, json);
			return;
		}

		if (json.Length() > 1000000)
		{
			m_iOversizedDroppedCount++;
			m_iDroppedCount++;
			Print(string.Format("[1stMD Stats] Refusing oversized payload endpoint=%1 bytes=%2", endpoint, json.Length()), LogLevel.ERROR);
			return;
		}

		string authenticatedEndpoint = BuildAuthenticatedEndpoint(endpoint);
		MDST_KillToastRestCallback callback = new MDST_KillToastRestCallback(endpoint, playerId);
		m_aCallbacks.Insert(callback);

		Print(string.Format("[1stMD Stats] REST POST dispatch endpoint=%1 bytes=%2 queue_depth=%3 toast_player=%4", endpoint, json.Length(), m_aQueue.Count(), playerId), LogLevel.NORMAL);
		int result = m_RestContext.POST(callback, authenticatedEndpoint, json);
		Print(string.Format("[1stMD Stats] REST POST result endpoint=%1 result=%2", endpoint, result), LogLevel.NORMAL);

		if (result < 0)
		{
			m_iDispatchFailedCount++;
			Print(string.Format("[1stMD Stats] POST dispatch failed endpoint=%1 result=%2", endpoint, result), LogLevel.WARNING);
			Queue(endpoint, json);
			return;
		}

		m_iDispatchedCount++;
	}

	void FlushQueue()
	{
		if (!IsReady())
		{
			Print(string.Format("[1stMD Stats] REST queue flush skipped; client not ready queue_depth=%1", m_aQueue.Count()), LogLevel.WARNING);
			return;
		}

		if (m_aQueue.Count() == 0)
			return;

		int sent = 0;
		int originalCount = m_aQueue.Count();
		Print(string.Format("[1stMD Stats] REST queue flush start queue_depth=%1", originalCount), LogLevel.NORMAL);

		for (int i = originalCount - 1; i >= 0; i--)
		{
			MDST_QueuedRequest request = m_aQueue[i];
			if (!request)
			{
				m_aQueue.Remove(i);
				continue;
			}

			request.m_iAttempts++;
			if (request.m_iAttempts > m_iMaxAttempts)
			{
				m_iDroppedCount++;
				Print(string.Format("[1stMD Stats] Dropping queued request endpoint=%1 after %2 attempts", request.m_sEndpoint, request.m_iAttempts), LogLevel.WARNING);
				m_aQueue.Remove(i);
				continue;
			}

			string authenticatedEndpoint = BuildAuthenticatedEndpoint(request.m_sEndpoint);
			MDST_StatsRestCallback callback = new MDST_StatsRestCallback(request.m_sEndpoint);
			m_aCallbacks.Insert(callback);

			Print(string.Format("[1stMD Stats] REST queued POST dispatch endpoint=%1 attempt=%2", request.m_sEndpoint, request.m_iAttempts), LogLevel.NORMAL);
			int result = m_RestContext.POST(callback, authenticatedEndpoint, request.m_sJson);
			Print(string.Format("[1stMD Stats] REST queued POST result endpoint=%1 result=%2", request.m_sEndpoint, result), LogLevel.NORMAL);

			if (result >= 0)
			{
				m_aQueue.Remove(i);
				m_iDispatchedCount++;
				sent++;
			}
			else
			{
				m_iDispatchFailedCount++;
			}
		}

		Print(string.Format("[1stMD Stats] REST queue flush complete sent=%1 remaining=%2", sent, m_aQueue.Count()), LogLevel.NORMAL);
	}

	int GetQueuedRequestCount()
	{
		return m_aQueue.Count();
	}

	int GetDispatchedCount()
	{
		return m_iDispatchedCount;
	}

	int GetQueuedCount()
	{
		return m_iQueuedCount;
	}

	int GetDroppedCount()
	{
		return m_iDroppedCount;
	}

	int GetOversizedDroppedCount()
	{
		return m_iOversizedDroppedCount;
	}

	int GetDispatchFailedCount()
	{
		return m_iDispatchFailedCount;
	}

	protected void Queue(string endpoint, string json)
	{
		if (m_aQueue.Count() >= m_iMaxQueuedRequests)
		{
			m_aQueue.Remove(0);
			m_iDroppedCount++;
			Print("[1stMD Stats] Queue full; dropped oldest request.", LogLevel.WARNING);
		}

		m_iQueuedCount++;
		m_aQueue.Insert(new MDST_QueuedRequest(endpoint, json));
		Print(string.Format("[1stMD Stats] REST queued endpoint=%1 bytes=%2 queue_depth=%3", endpoint, json.Length(), m_aQueue.Count()), LogLevel.NORMAL);
	}
}
