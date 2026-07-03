//------------------------------------------------------------------------------------------------
//! Game mode hooks and broad server-side bridge methods for stats telemetry.
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

	override void OnPlayerDisconnected(int playerId, KickCauseCode cause, int timeout)
	{
		super.OnPlayerDisconnected(playerId, cause, timeout);

		if (!IsMaster())
			return;

		MDST_StatsGameModeComponent stats = MDST_StatsGameModeComponent.GetInstance();
		if (!stats || !stats.IsStatsReady())
			return;

		stats.SendSessionEnd(playerId);
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

		IEntity sourceEntity = killer.GetInstigatorEntity();
		string weaponId = MDST_WeaponMetadata.GetWeaponIdForPlayer(killerPlayerId, sourceEntity);
		string weaponName = MDST_WeaponMetadata.GetWeaponNameForPlayer(killerPlayerId, sourceEntity);
		float distanceMeters = MDST_GetCombatDistance(playerEntity, killerEntity);
		if (distanceMeters <= 0 && sourceEntity)
			distanceMeters = MDST_GetCombatDistance(playerEntity, sourceEntity);

		if (killerPlayerId > 0 && killerPlayerId != playerId)
		{
			bool isTeamkill = MDST_IsTeamkill(playerEntity, killerEntity, playerId, killerPlayerId);
			if (isTeamkill)
			{
				Print(string.Format("[1stMD Stats] Teamkill detected killer=%1 victim=%2 distance=%3 weapon=%4 source=%5", killerPlayerId, playerId, distanceMeters, weaponName, sourceEntity), LogLevel.NORMAL);
				stats.SendTeamkillWithTarget(killerPlayerId, playerId, weaponId, weaponName, distanceMeters);
			}
			else
			{
				Print(string.Format("[1stMD Stats] Player kill detected killer=%1 victim=%2 distance=%3 weapon=%4 source=%5", killerPlayerId, playerId, distanceMeters, weaponName, sourceEntity), LogLevel.NORMAL);
				stats.SendPlayerKillWithTarget(killerPlayerId, playerId, weaponId, weaponName, distanceMeters);
			}

			if (!isTeamkill && MDST_WeaponMetadata.IsPlayerInVehicle(killerPlayerId))
			{
				string vehicleId = MDST_WeaponMetadata.GetVehicleIdForPlayer(killerPlayerId);
				string vehicleName = MDST_WeaponMetadata.GetVehicleNameForPlayer(killerPlayerId);
				Print(string.Format("[1stMD Stats] Vehicle player kill detected player_id=%1 vehicle=%2", killerPlayerId, vehicleName), LogLevel.NORMAL);
				stats.SendVehicleKill(killerPlayerId, vehicleId, vehicleName);
			}
		}

		if (killerPlayerId > 0 && killerPlayerId == playerId)
		{
			Print(string.Format("[1stMD Stats] Self-kill detected player=%1 weapon=%2 source=%3", killerPlayerId, weaponName, sourceEntity), LogLevel.NORMAL);
		}

		return handled;
	}

	void MDST_RunStatsCommand(int playerId, string command, string data)
	{
		if (!IsMaster())
			return;

		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (!stats)
		{
			Print("[1stMD Stats] Command ignored because stats component is not ready.", LogLevel.WARNING);
			return;
		}

		if (command == "link")
		{
			stats.SendLinkCode(playerId, data);
			return;
		}

		if (command == "endmatch")
		{
			MDST_EndActiveStatsMatch(data);
			return;
		}

		Print(string.Format("[1stMD Stats] Unknown command '%1' from player %2", command, playerId), LogLevel.WARNING);
	}

	void MDST_RecordPlayerKill(int playerId, string weaponId = "", string weaponName = "", float distanceMeters = 0)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendPlayerKill(playerId, weaponId, weaponName, distanceMeters);
	}

	void MDST_RecordPlayerKillWithTarget(int playerId, int targetPlayerId, string weaponId = "", string weaponName = "", float distanceMeters = 0)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendPlayerKillWithTarget(playerId, targetPlayerId, weaponId, weaponName, distanceMeters);
	}

	void MDST_RecordAIKill(int playerId, string weaponId = "", string weaponName = "", float distanceMeters = 0)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendAIKill(playerId, weaponId, weaponName, distanceMeters);
	}

	void MDST_RecordAIKillsNear(vector position, float radiusMeters, int killCount)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendAIKillsNear(position, radiusMeters, killCount);
	}

	void MDST_RecordDeath(int playerId)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendDeath(playerId);
	}

	void MDST_RecordTeamkill(int playerId, string weaponId = "", string weaponName = "", float distanceMeters = 0)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendTeamkill(playerId, weaponId, weaponName, distanceMeters);
	}

	void MDST_RecordTeamkillWithTarget(int playerId, int targetPlayerId, string weaponId = "", string weaponName = "", float distanceMeters = 0)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendTeamkillWithTarget(playerId, targetPlayerId, weaponId, weaponName, distanceMeters);
	}

	void MDST_RecordAssist(int playerId, string weaponId = "", string weaponName = "")
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendAssist(playerId, weaponId, weaponName);
	}

	void MDST_RecordRevive(int playerId, int timeAsMedicSeconds = 0)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendRevive(playerId, timeAsMedicSeconds);
	}

	void MDST_RecordBandage(int playerId, int timeAsMedicSeconds = 0)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendBandageUsed(playerId, timeAsMedicSeconds);
	}

	void MDST_RecordTourniquet(int playerId, int timeAsMedicSeconds = 0)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendTourniquetUsed(playerId, timeAsMedicSeconds);
	}

	void MDST_RecordHeal(int playerId, int timeAsMedicSeconds = 0)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendHeal(playerId, timeAsMedicSeconds);
	}

	void MDST_RecordMedicalEvent(int playerId, string eventType, int timeAsMedicSeconds = 0, float amount = 0)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendMedicalEvent(playerId, eventType, timeAsMedicSeconds, "", "", "", amount);
	}

	void MDST_RecordReviveWithTarget(int playerId, int targetPlayerId, int timeAsMedicSeconds = 0)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendReviveWithTarget(playerId, targetPlayerId, timeAsMedicSeconds);
	}

	void MDST_RecordHealWithTarget(int playerId, int targetPlayerId, int timeAsMedicSeconds = 0, float amount = 0)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendHealWithTarget(playerId, targetPlayerId, timeAsMedicSeconds, amount);
	}

	void MDST_RecordMedicalEventWithTarget(int playerId, string eventType, int targetPlayerId, int timeAsMedicSeconds = 0, float amount = 0)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendMedicalEventWithTarget(playerId, eventType, targetPlayerId, timeAsMedicSeconds, amount);
	}

	void MDST_RecordVehicleKill(int playerId, string vehicleId = "", string vehicleName = "")
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendVehicleKill(playerId, vehicleId, vehicleName);
	}

	void MDST_RecordVehicleDeath(int playerId, string vehicleId = "", string vehicleName = "")
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendVehicleDeath(playerId, vehicleId, vehicleName);
	}

	void MDST_RecordVehicleAssist(int playerId, string vehicleId = "", string vehicleName = "")
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendVehicleAssist(playerId, vehicleId, vehicleName);
	}

	void MDST_RecordVehicleDestroyed(int playerId, string vehicleId = "", string vehicleName = "")
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendVehicleDestroyed(playerId, vehicleId, vehicleName);
	}

	void MDST_RecordVehicleCrash(int playerId, string vehicleId = "", string vehicleName = "")
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendVehicleCrash(playerId, vehicleId, vehicleName);
	}

	void MDST_RecordVehicleRepair(int playerId, string vehicleId = "", string vehicleName = "")
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendVehicleRepair(playerId, vehicleId, vehicleName);
	}

	void MDST_RecordSupportEvent(int playerId, string eventType, string targetId = "", string targetName = "", float amount = 0)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendSupportEvent(playerId, eventType, targetId, targetName, amount);
	}

	void MDST_RecordSupportEventWithTarget(int playerId, string eventType, int targetPlayerId, float amount = 0)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendSupportEventWithTarget(playerId, eventType, targetPlayerId, amount);
	}

	void MDST_RecordResupply(int playerId, string targetId = "", string targetName = "")
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendResupply(playerId, targetId, targetName);
	}

	void MDST_RecordSupplyDelivery(int playerId, string targetId = "", string targetName = "")
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendSupplyDelivery(playerId, targetId, targetName);
	}

	void MDST_RecordTeamworkAction(int playerId, string targetId = "", string targetName = "")
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendTeamworkAction(playerId, targetId, targetName);
	}

	void MDST_RecordObjectiveCompleted(int playerId)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendObjectiveCompleted(playerId);
	}

	void MDST_RecordObjectiveCompletedNear(vector position, float radiusMeters = 250)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendObjectiveCompletedNear(position, radiusMeters);
	}

	void MDST_RecordObjectiveCapture(int playerId)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendObjectiveCapture(playerId);
	}

	void MDST_RecordObjectiveCaptureNear(vector position, float radiusMeters = 250)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendObjectiveCaptureNear(position, radiusMeters);
	}

	void MDST_RecordObjectiveDefense(int playerId)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendObjectiveDefense(playerId);
	}

	void MDST_RecordMissionParticipation(int playerId)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendMissionParticipation(playerId);
	}

	void MDST_RecordMissionParticipationNear(vector position, float radiusMeters = 250)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendMissionParticipationNear(position, radiusMeters);
	}

	void MDST_RecordPvPWin(int playerId)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendPvPWin(playerId);
	}

	void MDST_RecordPvPLoss(int playerId)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendPvPLoss(playerId);
	}

	void MDST_RecordSessionStart(int playerId)
	{
		MDST_SendSessionStart(playerId);
	}

	void MDST_RecordSessionEnd(int playerId)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendSessionEnd(playerId);
	}

	void MDST_StartStatsMatch(string matchId = "")
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (stats)
			stats.SendMatchStart(matchId);
	}

	void MDST_EndActiveStatsMatch(string winningFaction = "")
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (!stats)
			return;

		PlayerManager playerManager = GetGame().GetPlayerManager();
		if (playerManager)
		{
			array<int> playerIds = {};
			playerManager.GetPlayers(playerIds);

			foreach (int playerId : playerIds)
			{
				stats.SendSessionEnd(playerId);
			}
		}

		stats.SendMatchEnd(winningFaction);
	}

	protected MDST_StatsGameModeComponent MDST_GetStatsComponent()
	{
		if (!IsMaster())
			return null;

		MDST_StatsGameModeComponent stats = MDST_StatsGameModeComponent.GetInstance();
		if (!stats || !stats.IsStatsReady())
			return null;

		return stats;
	}

	protected void MDST_SendSessionStart(int playerId)
	{
		MDST_StatsGameModeComponent stats = MDST_GetStatsComponent();
		if (!stats)
			return;

		stats.SendSessionStart(playerId);
	}

	protected float MDST_GetCombatDistance(IEntity victimEntity, IEntity killerEntity)
	{
		if (!victimEntity || !killerEntity)
			return 0;

		return vector.Distance(victimEntity.GetOrigin(), killerEntity.GetOrigin());
	}

	protected bool MDST_IsTeamkill(IEntity victimEntity, IEntity killerEntity, int victimPlayerId, int killerPlayerId)
	{
		if (victimPlayerId <= 0 || killerPlayerId <= 0 || victimPlayerId == killerPlayerId)
			return false;

		IEntity resolvedKillerEntity = killerEntity;
		if (!resolvedKillerEntity)
		{
			PlayerManager playerManager = GetGame().GetPlayerManager();
			if (playerManager)
				resolvedKillerEntity = playerManager.GetPlayerControlledEntity(killerPlayerId);
		}

		if (!victimEntity || !resolvedKillerEntity)
			return false;

		FactionAffiliationComponent victimFaction = FactionAffiliationComponent.Cast(victimEntity.FindComponent(FactionAffiliationComponent));
		FactionAffiliationComponent killerFaction = FactionAffiliationComponent.Cast(resolvedKillerEntity.FindComponent(FactionAffiliationComponent));
		if (!victimFaction || !killerFaction)
			return false;

		Faction victimSide = victimFaction.GetAffiliatedFaction();
		Faction killerSide = killerFaction.GetAffiliatedFaction();
		if (!victimSide || !killerSide)
			return false;

		return victimSide == killerSide;
	}
}
