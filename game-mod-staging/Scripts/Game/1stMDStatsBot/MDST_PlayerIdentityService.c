//------------------------------------------------------------------------------------------------
//! Player identity adapter.
//! Never use player names as unique identifiers. Names are sent only for display.
//------------------------------------------------------------------------------------------------

class MDST_PlayerIdentityService
{
	MDST_PlayerIdentity Resolve(int playerId)
	{
		PlayerManager playerManager = GetGame().GetPlayerManager();
		if (!playerManager)
			return null;

		string displayName = playerManager.GetPlayerName(playerId);
		string stableId = GetStablePlayerId(playerManager, playerId);

		if (stableId.IsEmpty())
			stableId = playerId.ToString();

		return new MDST_PlayerIdentity(playerId, stableId, displayName);
	}

	protected string GetStablePlayerId(PlayerManager playerManager, int playerId)
	{
		UUID identityId = SCR_PlayerIdentityUtils.GetPlayerIdentityId(playerId);
		string value = identityId;

		if (!value.IsEmpty())
			return value;

		// Fallback keeps local tests moving, but production stats should rely on the stable identity above.
		return playerId.ToString();
	}
}
