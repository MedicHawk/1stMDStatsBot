//------------------------------------------------------------------------------------------------
//! Lightweight chat command integration for account linking.
//! Players can type !link CODE in chat after generating a code with the Discord /link command.
//------------------------------------------------------------------------------------------------

modded class SCR_ChatComponent
{
	override void OnNewMessage(string msg, int channelId, int senderId)
	{
		super.OnNewMessage(msg, channelId, senderId);
		MDST_TryHandleLinkCommand(msg, senderId);
	}

	protected void MDST_TryHandleLinkCommand(string msg, int senderId)
	{
		string code = MDST_ExtractLinkCode(msg);
		if (code.IsEmpty())
			return;

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

		stats.SendLinkCode(senderId, code);
		Print(string.Format("[1stMD Stats] Link command submitted for player_id=%1", senderId), LogLevel.NORMAL);
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
