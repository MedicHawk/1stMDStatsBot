//------------------------------------------------------------------------------------------------
//! UI-agnostic client/server bridge for player actions and local stat notifications.
//! Other addons can call SCR_PlayerControllerGroupComponent.MDST_RequestLinkCode(code).
//------------------------------------------------------------------------------------------------

modded class SCR_PlayerControllerGroupComponent
{
	static void MDST_ShowKillToastToPlayer(int playerId, string text)
	{
		if (playerId <= 0 || text.IsEmpty())
			return;

		SCR_PlayerControllerGroupComponent groupComponent = SCR_PlayerControllerGroupComponent.GetPlayerControllerComponent(playerId);
		if (!groupComponent)
		{
			Print(string.Format("[1stMD Stats] Kill toast skipped; player controller component missing player_id=%1", playerId), LogLevel.WARNING);
			return;
		}

		groupComponent.MDST_ShowKillToast(text);
	}

	void MDST_RequestLinkCode(string code)
	{
		if (!MDST_IsValidLinkCode(code))
		{
			Print("[1stMD Stats] Link code rejected locally due to invalid format.", LogLevel.WARNING);
			return;
		}

		Rpc(MDST_RpcRequestLinkCode, code);
	}

	void MDST_ShowKillToast(string text)
	{
		if (text.IsEmpty())
			return;

		Rpc(MDST_RpcShowKillToast, text);
	}

	[RplRpc(RplChannel.Reliable, RplRcver.Server)]
	protected void MDST_RpcRequestLinkCode(string code)
	{
		if (!MDST_IsValidLinkCode(code))
		{
			Print("[1stMD Stats] Link code rejected on server due to invalid format.", LogLevel.WARNING);
			return;
		}

		int playerId = GetPlayerID();
		if (playerId <= 0)
		{
			Print("[1stMD Stats] Link code rejected because player id is unavailable.", LogLevel.WARNING);
			return;
		}

		MDST_StatsGameModeComponent stats = MDST_StatsGameModeComponent.GetInstance();
		if (!stats || !stats.IsStatsReady())
		{
			Print("[1stMD Stats] Link code rejected because stats component is not ready.", LogLevel.WARNING);
			return;
		}

		stats.SendLinkCode(playerId, code);
	}

	[RplRpc(RplChannel.Reliable, RplRcver.Owner)]
	protected void MDST_RpcShowKillToast(string text)
	{
		if (text.IsEmpty())
			return;

		SCR_HintManagerComponent.ShowCustomHint(text, "1stMD Stats", 4.0);
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
