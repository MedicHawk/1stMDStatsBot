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
		Print(string.Format("[1stMD Stats] REST success endpoint=%1 bytes=%2", m_sEndpoint, dataSize), LogLevel.VERBOSE);
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

	void Configure(string apiBaseUrl, string serverId, string apiKey, bool enabled)
	{
		m_sApiBaseUrl = apiBaseUrl;
		m_sServerId = serverId;
		m_sApiKey = apiKey;
		m_bEnabled = enabled;

		if (!m_sApiBaseUrl.EndsWith("/"))
			m_sApiBaseUrl += "/";

		if (m_bEnabled)
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

		string headers = string.Format(
			"Content-Type: application/json\r\nx-server-id: %1\r\nx-api-key: %2",
			m_sServerId,
			m_sApiKey
		);

		m_RestContext.SetHeaders(headers);
	}

	void Post(string endpoint, string json)
	{
		if (!IsReady())
		{
			Queue(endpoint, json);
			return;
		}

		if (json.Length() > 1000000)
		{
			Print(string.Format("[1stMD Stats] Refusing oversized payload endpoint=%1 bytes=%2", endpoint, json.Length()), LogLevel.ERROR);
			return;
		}

		MDST_StatsRestCallback callback = new MDST_StatsRestCallback(endpoint);
		m_aCallbacks.Insert(callback);

		int result = m_RestContext.POST(callback, endpoint, json);
		if (result < 0)
		{
			Print(string.Format("[1stMD Stats] POST dispatch failed endpoint=%1 result=%2", endpoint, result), LogLevel.WARNING);
			Queue(endpoint, json);
		}
	}

	void FlushQueue()
	{
		if (!IsReady())
			return;

		if (m_aQueue.Count() == 0)
			return;

		int sent = 0;
		int originalCount = m_aQueue.Count();

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
				Print(string.Format("[1stMD Stats] Dropping queued request endpoint=%1 after %2 attempts", request.m_sEndpoint, request.m_iAttempts), LogLevel.WARNING);
				m_aQueue.Remove(i);
				continue;
			}

			MDST_StatsRestCallback callback = new MDST_StatsRestCallback(request.m_sEndpoint);
			m_aCallbacks.Insert(callback);

			int result = m_RestContext.POST(callback, request.m_sEndpoint, request.m_sJson);
			if (result >= 0)
			{
				m_aQueue.Remove(i);
				sent++;
			}
		}

		if (sent > 0)
			Print(string.Format("[1stMD Stats] Flushed %1 queued request(s). Remaining=%2", sent, m_aQueue.Count()), LogLevel.VERBOSE);
	}

	int GetQueuedRequestCount()
	{
		return m_aQueue.Count();
	}

	protected void Queue(string endpoint, string json)
	{
		if (m_aQueue.Count() >= m_iMaxQueuedRequests)
		{
			m_aQueue.Remove(0);
			Print("[1stMD Stats] Queue full; dropped oldest request.", LogLevel.WARNING);
		}

		m_aQueue.Insert(new MDST_QueuedRequest(endpoint, json));
	}
}
