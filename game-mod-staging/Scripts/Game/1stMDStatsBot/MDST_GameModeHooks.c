//------------------------------------------------------------------------------------------------
//! Game mode hooks for lifecycle and combat events.
//------------------------------------------------------------------------------------------------

modded class SCR_BaseGameMode
{
	override void OnPlayerConnected(int playerId)
	{
		super.OnPlayerConnected(playerId);

		if (!IsMaster())
			return;

		MDST_SendSessionStart(playerId);
	}

	override bool HandlePlayerKilled(int playerId, IEntity playerEntity, IEntity killerEntity, notnull Instigator killer)
	{
		bool handled = super.HandlePlayerKilled(playerId, playerEntity, killerEntity, killer);

		if (!IsMaster())
			return handled;

		MDST_StatsGameModeComponent stats = MDST_StatsGameModeComponent.GetInstance();
		if (!stats || !stats.IsStatsReady())
			return handled;

		if (playerId > 0)
			stats.SendDeath(playerId);

		int killerPlayerId = killer.GetInstigatorPlayerID();
		if (killerPlayerId <= 0 && killerEntity)
		{
			PlayerManager playerManager = GetGame().GetPlayerManager();
			if (playerManager)
				killerPlayerId = playerManager.GetPlayerIdFromControlledEntity(killerEntity);
		}

		if (killerPlayerId > 0 && killerPlayerId != playerId)
			stats.SendPlayerKill(killerPlayerId);

		if (killerPlayerId > 0 && killerPlayerId == playerId)
			stats.SendTeamkill(killerPlayerId);

		return handled;
	}

	void MDST_RunStatsCommand(int playerId, string command, string data)
	{
		if (!IsMaster())
			return;

		MDST_StatsGameModeComponent stats = MDST_StatsGameModeComponent.GetInstance();
		if (!stats || !stats.IsStatsReady())
		{
			Print("[1stMD Stats] Command ignored because stats component is not ready.", LogLevel.WARNING);
			return;
		}

		if (command == "link")
		{
			stats.SendLinkCode(playerId, data);
			return;
		}

		Print(string.Format("[1stMD Stats] Unknown command '%1' from player %2", command, playerId), LogLevel.WARNING);
	}

	void MDST_RecordAIKill(int playerId, string weaponId = "", string weaponName = "", float distanceMeters = 0)
	{
		if (!IsMaster())
			return;

		MDST_StatsGameModeComponent stats = MDST_StatsGameModeComponent.GetInstance();
		if (!stats || !stats.IsStatsReady())
			return;

		stats.SendAIKill(playerId, weaponId, weaponName, distanceMeters);
	}

	void MDST_RecordAIKillsNear(vector position, float radiusMeters, int killCount)
	{
		if (!IsMaster())
			return;

		MDST_StatsGameModeComponent stats = MDST_StatsGameModeComponent.GetInstance();
		if (!stats || !stats.IsStatsReady())
			return;

		stats.SendAIKillsNear(position, radiusMeters, killCount);
	}

	void MDST_RecordRevive(int playerId, int timeAsMedicSeconds = 0)
	{
		if (!IsMaster())
			return;

		MDST_StatsGameModeComponent stats = MDST_StatsGameModeComponent.GetInstance();
		if (!stats || !stats.IsStatsReady())
			return;

		stats.SendRevive(playerId, timeAsMedicSeconds);
	}

	void MDST_RecordBandage(int playerId, int timeAsMedicSeconds = 0)
	{
		if (!IsMaster())
			return;

		MDST_StatsGameModeComponent stats = MDST_StatsGameModeComponent.GetInstance();
		if (!stats || !stats.IsStatsReady())
			return;

		stats.SendBandageUsed(playerId, timeAsMedicSeconds);
	}

	void MDST_RecordTourniquet(int playerId, int timeAsMedicSeconds = 0)
	{
		if (!IsMaster())
			return;

		MDST_StatsGameModeComponent stats = MDST_StatsGameModeComponent.GetInstance();
		if (!stats || !stats.IsStatsReady())
			return;

		stats.SendTourniquetUsed(playerId, timeAsMedicSeconds);
	}

	void MDST_RecordObjectiveCompleted(int playerId)
	{
		if (!IsMaster())
			return;

		MDST_StatsGameModeComponent stats = MDST_StatsGameModeComponent.GetInstance();
		if (!stats || !stats.IsStatsReady())
			return;

		stats.SendObjectiveCompleted(playerId);
	}

	void MDST_RecordObjectiveCompletedNear(vector position, float radiusMeters = 250)
	{
		if (!IsMaster())
			return;

		MDST_StatsGameModeComponent stats = MDST_StatsGameModeComponent.GetInstance();
		if (!stats || !stats.IsStatsReady())
			return;

		stats.SendObjectiveCompletedNear(position, radiusMeters);
	}

	void MDST_RecordObjectiveCapture(int playerId)
	{
		if (!IsMaster())
			return;

		MDST_StatsGameModeComponent stats = MDST_StatsGameModeComponent.GetInstance();
		if (!stats || !stats.IsStatsReady())
			return;

		stats.SendObjectiveCapture(playerId);
	}

	void MDST_RecordObjectiveCaptureNear(vector position, float radiusMeters = 250)
	{
		if (!IsMaster())
			return;

		MDST_StatsGameModeComponent stats = MDST_StatsGameModeComponent.GetInstance();
		if (!stats || !stats.IsStatsReady())
			return;

		stats.SendObjectiveCaptureNear(position, radiusMeters);
	}

	void MDST_RecordMissionParticipationNear(vector position, float radiusMeters = 250)
	{
		if (!IsMaster())
			return;

		MDST_StatsGameModeComponent stats = MDST_StatsGameModeComponent.GetInstance();
		if (!stats || !stats.IsStatsReady())
			return;

		stats.SendMissionParticipationNear(position, radiusMeters);
	}

	void MDST_RecordVehicleDestroyed(int playerId, string vehicleId = "", string vehicleName = "")
	{
		if (!IsMaster())
			return;

		MDST_StatsGameModeComponent stats = MDST_StatsGameModeComponent.GetInstance();
		if (!stats || !stats.IsStatsReady())
			return;

		stats.SendVehicleDestroyed(playerId, vehicleId, vehicleName);
	}

	protected void MDST_SendSessionStart(int playerId)
	{
		MDST_StatsGameModeComponent stats = MDST_StatsGameModeComponent.GetInstance();
		if (!stats || !stats.IsStatsReady())
			return;

		stats.SendSessionStart(playerId);
	}
}
