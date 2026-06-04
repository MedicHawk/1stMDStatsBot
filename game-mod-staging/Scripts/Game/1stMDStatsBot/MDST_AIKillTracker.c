//------------------------------------------------------------------------------------------------
//! AI kill attribution helpers.
//! These methods let mission scripts or future damage hooks report AI deaths with a player source.
//------------------------------------------------------------------------------------------------

modded class MDST_StatsGameModeComponent
{
	protected ref array<IEntity> m_MDST_RecentAIKillTargets;
	protected ref array<float> m_MDST_RecentAIKillTimes;

	//------------------------------------------------------------------------------------------------
	void SendAIKillFromEntity(int playerId, IEntity aiEntity, string weaponId = "", string weaponName = "", IEntity killerEntity = null)
	{
		if (playerId <= 0)
			return;

		if (aiEntity && !MDST_RegisterAIKillTarget(aiEntity))
		{
			Print(string.Format("[1stMD Stats] AI kill duplicate ignored player_id=%1", playerId), LogLevel.NORMAL);
			return;
		}

		float distanceMeters = 0;
		if (aiEntity && killerEntity)
			distanceMeters = vector.Distance(aiEntity.GetOrigin(), killerEntity.GetOrigin());

		Print(string.Format("[1stMD Stats] AI kill attributed player_id=%1 distance=%2 weapon=%3", playerId, distanceMeters, weaponName), LogLevel.NORMAL);
		SendAIKill(playerId, weaponId, weaponName, distanceMeters);
	}

	//------------------------------------------------------------------------------------------------
	int MDST_ResolvePlayerIdFromEntity(IEntity entity)
	{
		if (!entity)
			return 0;

		PlayerManager playerManager = GetGame().GetPlayerManager();
		if (!playerManager)
			return 0;

		return playerManager.GetPlayerIdFromControlledEntity(entity);
	}

	//------------------------------------------------------------------------------------------------
	void SendAIKillNearPosition(vector position, float radiusMeters = 250, string weaponId = "", string weaponName = "")
	{
		int playerId = MDST_GetNearestPlayerId(position, radiusMeters);
		if (playerId <= 0)
		{
			Print(string.Format("[1stMD Stats] AI kill near position ignored, no player within %1m", radiusMeters), LogLevel.NORMAL);
			return;
		}

		SendAIKill(playerId, weaponId, weaponName);
	}

	//------------------------------------------------------------------------------------------------
	protected int MDST_GetNearestPlayerId(vector position, float radiusMeters)
	{
		PlayerManager playerManager = GetGame().GetPlayerManager();
		if (!playerManager)
			return 0;

		array<int> playerIds = {};
		playerManager.GetPlayers(playerIds);

		int nearestPlayerId = 0;
		float nearestDistance = radiusMeters + 1;

		foreach (int playerId : playerIds)
		{
			IEntity playerEntity = playerManager.GetPlayerControlledEntity(playerId);
			if (!playerEntity)
				continue;

			float distance = vector.Distance(playerEntity.GetOrigin(), position);
			if (distance <= radiusMeters && distance < nearestDistance)
			{
				nearestDistance = distance;
				nearestPlayerId = playerId;
			}
		}

		return nearestPlayerId;
	}

	//------------------------------------------------------------------------------------------------
	protected bool MDST_RegisterAIKillTarget(IEntity aiEntity)
	{
		if (!m_MDST_RecentAIKillTargets)
		{
			m_MDST_RecentAIKillTargets = {};
			m_MDST_RecentAIKillTimes = {};
		}

		float now = GetGame().GetWorld().GetWorldTime() * 0.001;
		MDST_PruneRecentAIKillTargets(now);

		for (int i = 0; i < m_MDST_RecentAIKillTargets.Count(); i++)
		{
			if (m_MDST_RecentAIKillTargets[i] == aiEntity)
				return false;
		}

		m_MDST_RecentAIKillTargets.Insert(aiEntity);
		m_MDST_RecentAIKillTimes.Insert(now);
		return true;
	}

	//------------------------------------------------------------------------------------------------
	protected void MDST_PruneRecentAIKillTargets(float now)
	{
		for (int i = m_MDST_RecentAIKillTargets.Count() - 1; i >= 0; i--)
		{
			if (!m_MDST_RecentAIKillTargets[i] || now - m_MDST_RecentAIKillTimes[i] > 30)
			{
				m_MDST_RecentAIKillTargets.Remove(i);
				m_MDST_RecentAIKillTimes.Remove(i);
			}
		}
	}
}

modded class SCR_BaseGameMode
{
	//------------------------------------------------------------------------------------------------
	void MDST_RecordAIKilledByPlayer(int playerId, IEntity aiEntity, string weaponId = "", string weaponName = "")
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (!stats)
			return;

		IEntity playerEntity = null;
		PlayerManager playerManager = GetGame().GetPlayerManager();
		if (playerManager && playerId > 0)
			playerEntity = playerManager.GetPlayerControlledEntity(playerId);

		stats.SendAIKillFromEntity(playerId, aiEntity, weaponId, weaponName, playerEntity);
	}

	//------------------------------------------------------------------------------------------------
	void MDST_RecordAIKilledByEntity(IEntity aiEntity, IEntity killerEntity, string weaponId = "", string weaponName = "")
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (!stats)
			return;

		int playerId = stats.MDST_ResolvePlayerIdFromEntity(killerEntity);
		stats.SendAIKillFromEntity(playerId, aiEntity, weaponId, weaponName, killerEntity);
	}

	//------------------------------------------------------------------------------------------------
	void MDST_RecordAIKilledByInstigator(IEntity aiEntity, IEntity killerEntity, notnull Instigator killer, string weaponId = "", string weaponName = "")
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (!stats)
			return;

		int playerId = killer.GetInstigatorPlayerID();
		if (playerId <= 0)
			playerId = stats.MDST_ResolvePlayerIdFromEntity(killerEntity);

		stats.SendAIKillFromEntity(playerId, aiEntity, weaponId, weaponName, killerEntity);
	}

	//------------------------------------------------------------------------------------------------
	void MDST_RecordAIKillNear(vector position, float radiusMeters = 250, string weaponId = "", string weaponName = "")
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendAIKillNearPosition(position, radiusMeters, weaponId, weaponName);
	}
}
