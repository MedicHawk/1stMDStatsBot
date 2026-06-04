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

		MDST_StatsGameModeComponent stats = MDST_StatsGameModeComponent.GetInstance();
		if (!stats || !stats.IsStatsReady())
		{
			Print("[1stMD Stats] Link command rejected because stats component is not ready.", LogLevel.WARNING);
			return;
		}

		Print(string.Format("[1stMD Stats] Link command accepted; submitting sender_id=%1", senderId), LogLevel.NORMAL);
		stats.SendLinkCode(senderId, code);
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
