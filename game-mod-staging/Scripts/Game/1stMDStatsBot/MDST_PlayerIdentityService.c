//------------------------------------------------------------------------------------------------
//! Player identity adapter.
//! Never use player names as unique identifiers. Names are sent only for display.
//------------------------------------------------------------------------------------------------

class MDST_PlayerIdentityService
{
	protected ref map<int, ref MDST_PlayerIdentity> m_mIdentityCache = new map<int, ref MDST_PlayerIdentity>();

	MDST_PlayerIdentity Resolve(int playerId)
	{
		PlayerManager playerManager = GetGame().GetPlayerManager();
		if (!playerManager)
			return GetCached(playerId);

		string displayName = playerManager.GetPlayerName(playerId);
		string stableId = GetStablePlayerId(playerManager, playerId);
		string rankName = GetRankName(playerManager, playerId);
		MDST_PlayerIdentity cached = GetCached(playerId);

		if (stableId.IsEmpty() && cached)
			stableId = cached.m_sStableId;

		if (displayName.IsEmpty() && cached)
			displayName = cached.m_sDisplayName;

		if (rankName.IsEmpty() && cached)
			rankName = cached.m_sRankName;

		if (stableId.IsEmpty())
			stableId = playerId.ToString();

		MDST_PlayerIdentity identity = new MDST_PlayerIdentity(playerId, stableId, displayName, rankName);
		m_mIdentityCache.Set(playerId, identity);
		return identity;
	}

	protected MDST_PlayerIdentity GetCached(int playerId)
	{
		return m_mIdentityCache.Get(playerId);
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

	protected string GetRankName(PlayerManager playerManager, int playerId)
	{
		IEntity playerEntity = playerManager.GetPlayerControlledEntity(playerId);
		if (!playerEntity)
			return "";

		return SCR_CharacterRankComponent.GetCharacterRankName(playerEntity);
	}
}
