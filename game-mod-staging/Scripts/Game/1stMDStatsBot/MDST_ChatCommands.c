//------------------------------------------------------------------------------------------------
//! Lightweight chat command integration for account linking.
//! Players can type !link CODE in chat after generating a code with the Discord /link command.
//------------------------------------------------------------------------------------------------

modded class SCR_ChatComponent
{
	override void OnNewMessage(string msg, int channelId, int senderId)
	{
		super.OnNewMessage(msg, channelId, senderId);
		Print(string.Format("[1stMD Stats] Chat observed sender_id=%1 channel=%2 length=%3", senderId, channelId, msg.Length()), LogLevel.NORMAL);
		MDST_TryHandleLinkCommand(msg, senderId);
		MDST_TryHandleStatsCommand(msg, senderId);
	}

	protected void MDST_TryHandleLinkCommand(string msg, int senderId)
	{
		string code = MDST_ExtractLinkCode(msg);
		if (code.IsEmpty())
			return;

		Print(string.Format("[1stMD Stats] Link command detected sender_id=%1 code_len=%2", senderId, code.Length()), LogLevel.NORMAL);

		if (!MDST_IsValidLinkCode(code))
		{
			Print("[1stMD Stats] Link command rejected due to invalid code format.", LogLevel.WARNING);
			return;
		}

		SCR_PlayerControllerGroupComponent localGroupComponent = SCR_PlayerControllerGroupComponent.GetLocalPlayerControllerGroupComponent();
		if (localGroupComponent)
		{
			Print("[1stMD Stats] Link command forwarding through local player controller RPC.", LogLevel.NORMAL);
			localGroupComponent.MDST_RequestLinkCode(code);
			return;
		}

		MDST_StatsGameModeComponent stats = MDST_StatsGameModeComponent.GetInstance();
		if (!stats || !stats.IsStatsReady())
		{
			Print("[1stMD Stats] Link command rejected because no local RPC bridge or ready server stats component was found.", LogLevel.WARNING);
			return;
		}

		Print(string.Format("[1stMD Stats] Link command submitting directly on server sender_id=%1", senderId), LogLevel.NORMAL);
		stats.SendLinkCode(senderId, code);
	}

	protected void MDST_TryHandleStatsCommand(string msg, int senderId)
	{
		if (!MDST_IsStatsCommand(msg))
			return;

		Print(string.Format("[1stMD Stats] Stats popup command detected sender_id=%1", senderId), LogLevel.NORMAL);

		SCR_PlayerControllerGroupComponent localGroupComponent = SCR_PlayerControllerGroupComponent.GetLocalPlayerControllerGroupComponent();
		if (localGroupComponent)
		{
			if (localGroupComponent.GetPlayerID() != senderId)
				return;

			Print("[1stMD Stats] Stats popup command forwarding through local player controller RPC.", LogLevel.NORMAL);
			localGroupComponent.MDST_RequestStatsToast();
			return;
		}

		MDST_StatsGameModeComponent stats = MDST_StatsGameModeComponent.GetInstance();
		if (!stats || !stats.IsStatsReady())
		{
			Print("[1stMD Stats] Stats popup command rejected because no local RPC bridge or ready server stats component was found.", LogLevel.WARNING);
			return;
		}

		Print(string.Format("[1stMD Stats] Stats popup command submitting directly on server sender_id=%1", senderId), LogLevel.NORMAL);
		stats.SendPlayerSnapshotToast(senderId);
	}

	protected string MDST_ExtractLinkCode(string msg)
	{
		if (msg.IsEmpty())
			return "";

		string normalized = msg.Trim();
		if (normalized.StartsWith("!link "))
			return normalized.Substring(6, normalized.Length() - 6).Trim();

		if (normalized.StartsWith("/link "))
			return normalized.Substring(6, normalized.Length() - 6).Trim();

		return "";
	}

	protected bool MDST_IsStatsCommand(string msg)
	{
		if (msg.IsEmpty())
			return false;

		string normalized = msg.Trim();
		return normalized == "!stats" || normalized == "/stats";
	}

	protected bool MDST_IsValidLinkCode(string code)
	{
		if (code.IsEmpty())
			return false;

		int length = code.Length();
		if (length < 4 || length > 16)
			return false;

		return true;
	}
}
