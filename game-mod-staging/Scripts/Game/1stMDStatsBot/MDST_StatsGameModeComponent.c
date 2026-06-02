//------------------------------------------------------------------------------------------------
//! 1stMD Stats Bot game mode component.
//! Add this component to each server scenario/game mode and configure API values in Workbench.
//------------------------------------------------------------------------------------------------

[ComponentEditorProps(category: "1stMD/Stats", description: "Sends Arma Reforger telemetry to the 1stMD Stats Bot backend.")]
class MDST_StatsGameModeComponentClass : SCR_BaseGameModeComponentClass
{
}

class MDST_StatsGameModeComponent : SCR_BaseGameModeComponent
{
	[Attribute(defvalue: "1", UIWidgets.CheckBox, desc: "Enable stats reporting from this server.", category: "1stMD Stats")]
	protected bool m_bStatsEnabled;

	[Attribute(defvalue: "http://127.0.0.1:3000/", UIWidgets.EditBox, desc: "Backend API base URL.", category: "1stMD Stats")]
	protected string m_sApiBaseUrl;

	[Attribute(defvalue: "local-test", UIWidgets.EditBox, desc: "Server ID matching the backend servers.server_id value.", category: "1stMD Stats")]
	protected string m_sServerId;

	[Attribute(defvalue: "", UIWidgets.EditBox, desc: "Raw per-server API key. Backend stores only its hash.", category: "1stMD Stats")]
	protected string m_sApiKey;

	[Attribute(defvalue: "10", UIWidgets.Slider, desc: "Movement sample interval in seconds.", params: "5 30 1", category: "1stMD Stats")]
	protected float m_fMovementSampleSeconds;

	[Attribute(defvalue: "30", UIWidgets.Slider, desc: "Heartbeat interval in seconds.", params: "10 120 5", category: "1stMD Stats")]
	protected float m_fHeartbeatSeconds;

	[Attribute(defvalue: "15", UIWidgets.Slider, desc: "Retry queued API posts every N seconds.", params: "5 60 5", category: "1stMD Stats")]
	protected float m_fQueueFlushSeconds;

	[Attribute(defvalue: "unknown", UIWidgets.EditBox, desc: "Scenario/map name sent in heartbeat and match payloads.", category: "1stMD Stats")]
	protected string m_sScenarioName;

	[Attribute(defvalue: "0", UIWidgets.Slider, desc: "Configured max player slots. Set 0 if unknown.", params: "0 128 1", category: "1stMD Stats")]
	protected int m_iMaxPlayerSlots;

	protected ref MDST_StatsRestClient m_RestClient;
	protected ref MDST_PlayerIdentityService m_IdentityService;
	protected ref MDST_MovementTracker m_MovementTracker;
	protected string m_sCurrentMatchId;

	bool IsStatsReady()
	{
		return m_RestClient && m_RestClient.IsReady() && m_IdentityService;
	}

	//------------------------------------------------------------------------------------------------
	override void OnPostInit(IEntity owner)
	{
		super.OnPostInit(owner);

		if (!GetGame().InPlayMode())
			return;

		RplComponent rpl = RplComponent.Cast(owner.FindComponent(RplComponent));
		if (rpl && !rpl.IsMaster())
			return;

		GetGame().GetCallqueue().CallLater(InitializeStats, 3000, false);
	}

	//------------------------------------------------------------------------------------------------
	protected void InitializeStats()
	{
		if (!m_bStatsEnabled)
		{
			Print("[1stMD Stats] Disabled by component setting.", LogLevel.NORMAL);
			return;
		}

		m_RestClient = new MDST_StatsRestClient();
		m_RestClient.Configure(m_sApiBaseUrl, m_sServerId, m_sApiKey, m_bStatsEnabled);

		if (!m_RestClient.IsReady())
		{
			Print("[1stMD Stats] Missing API URL, server ID, or API key.", LogLevel.ERROR);
			return;
		}

		m_IdentityService = new MDST_PlayerIdentityService();
		m_MovementTracker = new MDST_MovementTracker(m_RestClient, m_IdentityService, m_fMovementSampleSeconds);

		GetGame().GetCallqueue().CallLater(SendHeartbeat, Math.Round(m_fHeartbeatSeconds * 1000), true);
		GetGame().GetCallqueue().CallLater(SampleMovement, Math.Round(m_fMovementSampleSeconds * 1000), true);
		GetGame().GetCallqueue().CallLater(FlushQueuedRequests, Math.Round(m_fQueueFlushSeconds * 1000), true);
		GetGame().GetCallqueue().CallLater(SendSessionStartsForConnectedPlayers, 5000, false);

		SendMatchStart();
		Print(string.Format("[1stMD Stats] Initialized server_id=%1 api=%2", m_sServerId, m_sApiBaseUrl), LogLevel.NORMAL);
	}

	//------------------------------------------------------------------------------------------------
	protected void SendHeartbeat()
	{
		PlayerManager playerManager = GetGame().GetPlayerManager();
		array<int> players = {};

		if (playerManager)
			playerManager.GetPlayers(players);

		string json = "{" +
			MDST_Json.PairInt("player_count", players.Count()) + "," +
			MDST_Json.PairInt("max_player_slots", m_iMaxPlayerSlots) + "," +
			MDST_Json.PairString("scenario", GetScenarioName()) + "," +
			MDST_Json.PairInt("uptime_seconds", Math.Round(GetGame().GetWorld().GetWorldTime() * 0.001)) +
		"}";

		m_RestClient.Post("api/status/heartbeat", json);
	}

	//------------------------------------------------------------------------------------------------
	protected void SampleMovement()
	{
		if (m_MovementTracker)
			m_MovementTracker.Sample();
	}

	//------------------------------------------------------------------------------------------------
	protected void FlushQueuedRequests()
	{
		if (m_RestClient)
			m_RestClient.FlushQueue();
	}

	//------------------------------------------------------------------------------------------------
	protected void SendSessionStartsForConnectedPlayers()
	{
		PlayerManager playerManager = GetGame().GetPlayerManager();
		if (!playerManager)
			return;

		array<int> playerIds = {};
		playerManager.GetPlayers(playerIds);

		foreach (int playerId : playerIds)
		{
			SendSessionStart(playerId);
		}
	}

	//------------------------------------------------------------------------------------------------
	void SendSessionStart(int playerId)
	{
		if (!IsStatsReady())
			return;

		MDST_PlayerIdentity identity = m_IdentityService.Resolve(playerId);
		if (!identity || !identity.IsValid())
			return;

		string json = "{" +
			MDST_Json.PairString("player_reforger_id", identity.m_sStableId) + "," +
			MDST_Json.PairString("player_name", identity.m_sDisplayName) +
		"}";

		m_RestClient.Post("api/ingest/session/start", json);
	}

	//------------------------------------------------------------------------------------------------
	void SendSessionEnd(int playerId)
	{
		if (!IsStatsReady())
			return;

		MDST_PlayerIdentity identity = m_IdentityService.Resolve(playerId);
		if (!identity || !identity.IsValid())
			return;

		string json = "{" +
			MDST_Json.PairString("player_reforger_id", identity.m_sStableId) + "," +
			MDST_Json.PairString("player_name", identity.m_sDisplayName) +
		"}";

		m_RestClient.Post("api/ingest/session/end", json);
	}

	//------------------------------------------------------------------------------------------------
	void SendLinkCode(int playerId, string code)
	{
		if (!IsStatsReady())
			return;

		MDST_PlayerIdentity identity = m_IdentityService.Resolve(playerId);
		if (!identity || !identity.IsValid())
			return;

		string json = "{" +
			MDST_Json.PairString("code", code) + "," +
			MDST_Json.PairString("player_reforger_id", identity.m_sStableId) + "," +
			MDST_Json.PairString("player_name", identity.m_sDisplayName) +
		"}";

		m_RestClient.Post("api/link/verify", json);
	}

	//------------------------------------------------------------------------------------------------
	void SendCombatEvent(int playerId, string eventType, string weaponId = "", string weaponName = "", float distanceMeters = 0, int shotsFired = 0, int hits = 0)
	{
		if (!IsStatsReady())
			return;

		MDST_PlayerIdentity identity = m_IdentityService.Resolve(playerId);
		if (!identity || !identity.IsValid())
			return;

		string json = "{" +
			MDST_Json.PairString("player_reforger_id", identity.m_sStableId) + "," +
			MDST_Json.PairString("player_name", identity.m_sDisplayName) + "," +
			MDST_Json.PairString("event_type", eventType) + "," +
			MDST_Json.PairString("weapon_id", weaponId) + "," +
			MDST_Json.PairString("weapon_name", weaponName) + "," +
			MDST_Json.PairFloat("distance_meters", distanceMeters) + "," +
			MDST_Json.PairInt("shots_fired", shotsFired) + "," +
			MDST_Json.PairInt("hits", hits) +
		"}";

		m_RestClient.Post("api/ingest/combat", json);
	}

	//------------------------------------------------------------------------------------------------
	void SendPlayerKill(int playerId, string weaponId = "", string weaponName = "", float distanceMeters = 0)
	{
		SendCombatEvent(playerId, "kill", weaponId, weaponName, distanceMeters);
	}

	//------------------------------------------------------------------------------------------------
	void SendAIKill(int playerId, string weaponId = "", string weaponName = "", float distanceMeters = 0)
	{
		SendCombatEvent(playerId, "ai_kill", weaponId, weaponName, distanceMeters);
	}

	//------------------------------------------------------------------------------------------------
	void SendAIKillsNear(vector position, float radiusMeters, int killCount)
	{
		if (killCount <= 0)
			return;

		array<int> playerIds = {};
		GetPlayersNearPosition(position, radiusMeters, playerIds);

		if (playerIds.Count() == 0)
			return;

		int credited = 0;

		while (credited < killCount)
		{
			foreach (int playerId : playerIds)
			{
				SendAIKill(playerId);
				credited++;

				if (credited >= killCount)
					break;
			}
		}
	}

	//------------------------------------------------------------------------------------------------
	void SendDeath(int playerId)
	{
		SendCombatEvent(playerId, "death");
	}

	//------------------------------------------------------------------------------------------------
	void SendTeamkill(int playerId, string weaponId = "", string weaponName = "", float distanceMeters = 0)
	{
		SendCombatEvent(playerId, "teamkill", weaponId, weaponName, distanceMeters);
	}

	//------------------------------------------------------------------------------------------------
	void SendAssist(int playerId, string weaponId = "", string weaponName = "")
	{
		SendCombatEvent(playerId, "assist", weaponId, weaponName);
	}

	//------------------------------------------------------------------------------------------------
	void SendMedicalEvent(int playerId, string eventType, int timeAsMedicSeconds = 0)
	{
		if (!IsStatsReady())
			return;

		MDST_PlayerIdentity identity = m_IdentityService.Resolve(playerId);
		if (!identity || !identity.IsValid())
			return;

		string json = "{" +
			MDST_Json.PairString("player_reforger_id", identity.m_sStableId) + "," +
			MDST_Json.PairString("player_name", identity.m_sDisplayName) + "," +
			MDST_Json.PairString("event_type", eventType) + "," +
			MDST_Json.PairInt("time_as_medic_seconds", timeAsMedicSeconds) +
		"}";

		m_RestClient.Post("api/ingest/medical", json);
	}

	//------------------------------------------------------------------------------------------------
	void SendRevive(int playerId, int timeAsMedicSeconds = 0)
	{
		SendMedicalEvent(playerId, "revive", timeAsMedicSeconds);
	}

	//------------------------------------------------------------------------------------------------
	void SendBandageUsed(int playerId, int timeAsMedicSeconds = 0)
	{
		SendMedicalEvent(playerId, "bandage", timeAsMedicSeconds);
	}

	//------------------------------------------------------------------------------------------------
	void SendTourniquetUsed(int playerId, int timeAsMedicSeconds = 0)
	{
		SendMedicalEvent(playerId, "tourniquet", timeAsMedicSeconds);
	}

	//------------------------------------------------------------------------------------------------
	void SendVehicleEvent(int playerId, string eventType, string vehicleId = "", string vehicleName = "", float distanceDrivenMeters = 0, float distancePassengerMeters = 0, int timeInVehicleSeconds = 0)
	{
		if (!IsStatsReady())
			return;

		MDST_PlayerIdentity identity = m_IdentityService.Resolve(playerId);
		if (!identity || !identity.IsValid())
			return;

		string json = "{" +
			MDST_Json.PairString("player_reforger_id", identity.m_sStableId) + "," +
			MDST_Json.PairString("player_name", identity.m_sDisplayName) + "," +
			MDST_Json.PairString("event_type", eventType) + "," +
			MDST_Json.PairString("vehicle_id", vehicleId) + "," +
			MDST_Json.PairString("vehicle_name", vehicleName) + "," +
			MDST_Json.PairFloat("distance_driven_meters", distanceDrivenMeters) + "," +
			MDST_Json.PairFloat("distance_passenger_meters", distancePassengerMeters) + "," +
			MDST_Json.PairInt("time_in_vehicle_seconds", timeInVehicleSeconds) +
		"}";

		m_RestClient.Post("api/ingest/vehicle", json);
	}

	//------------------------------------------------------------------------------------------------
	void SendVehicleKill(int playerId, string vehicleId = "", string vehicleName = "")
	{
		SendVehicleEvent(playerId, "kill", vehicleId, vehicleName);
	}

	//------------------------------------------------------------------------------------------------
	void SendVehicleDeath(int playerId, string vehicleId = "", string vehicleName = "")
	{
		SendVehicleEvent(playerId, "death", vehicleId, vehicleName);
	}

	//------------------------------------------------------------------------------------------------
	void SendVehicleAssist(int playerId, string vehicleId = "", string vehicleName = "")
	{
		SendVehicleEvent(playerId, "assist", vehicleId, vehicleName);
	}

	//------------------------------------------------------------------------------------------------
	void SendVehicleDestroyed(int playerId, string vehicleId = "", string vehicleName = "")
	{
		SendVehicleEvent(playerId, "destroyed", vehicleId, vehicleName);
	}

	//------------------------------------------------------------------------------------------------
	void SendVehicleCrash(int playerId, string vehicleId = "", string vehicleName = "")
	{
		SendVehicleEvent(playerId, "crash", vehicleId, vehicleName);
	}

	//------------------------------------------------------------------------------------------------
	void SendObjectiveEvent(int playerId, string eventType)
	{
		if (!IsStatsReady())
			return;

		MDST_PlayerIdentity identity = m_IdentityService.Resolve(playerId);
		if (!identity || !identity.IsValid())
			return;

		string json = "{" +
			MDST_Json.PairString("player_reforger_id", identity.m_sStableId) + "," +
			MDST_Json.PairString("player_name", identity.m_sDisplayName) + "," +
			MDST_Json.PairString("event_type", eventType) +
		"}";

		m_RestClient.Post("api/ingest/objective", json);
	}

	//------------------------------------------------------------------------------------------------
	void SendObjectiveCapture(int playerId)
	{
		SendObjectiveEvent(playerId, "capture");
	}

	//------------------------------------------------------------------------------------------------
	void SendObjectiveDefense(int playerId)
	{
		SendObjectiveEvent(playerId, "defense");
	}

	//------------------------------------------------------------------------------------------------
	void SendObjectiveCompleted(int playerId)
	{
		SendObjectiveEvent(playerId, "objective_completed");
	}

	//------------------------------------------------------------------------------------------------
	void SendObjectiveCompletedNear(vector position, float radiusMeters)
	{
		array<int> playerIds = {};
		GetPlayersNearPosition(position, radiusMeters, playerIds);

		foreach (int playerId : playerIds)
		{
			SendMissionParticipation(playerId);
			SendObjectiveCompleted(playerId);
		}
	}

	//------------------------------------------------------------------------------------------------
	void SendObjectiveCaptureNear(vector position, float radiusMeters)
	{
		array<int> playerIds = {};
		GetPlayersNearPosition(position, radiusMeters, playerIds);

		foreach (int playerId : playerIds)
		{
			SendMissionParticipation(playerId);
			SendObjectiveCapture(playerId);
		}
	}

	//------------------------------------------------------------------------------------------------
	void SendMissionParticipation(int playerId)
	{
		SendObjectiveEvent(playerId, "mission_participation");
	}

	//------------------------------------------------------------------------------------------------
	void SendPvPWin(int playerId)
	{
		SendObjectiveEvent(playerId, "pvp_win");
	}

	//------------------------------------------------------------------------------------------------
	void SendPvPLoss(int playerId)
	{
		SendObjectiveEvent(playerId, "pvp_loss");
	}

	//------------------------------------------------------------------------------------------------
	void SendMissionParticipationNear(vector position, float radiusMeters)
	{
		array<int> playerIds = {};
		GetPlayersNearPosition(position, radiusMeters, playerIds);

		foreach (int playerId : playerIds)
		{
			SendMissionParticipation(playerId);
		}
	}

	//------------------------------------------------------------------------------------------------
	void SendMatchStart(string matchId = "")
	{
		if (!IsStatsReady())
			return;

		if (matchId.IsEmpty())
			matchId = BuildMatchId();

		m_sCurrentMatchId = matchId;

		string json = "{" +
			MDST_Json.PairString("external_match_id", m_sCurrentMatchId) + "," +
			MDST_Json.PairString("scenario", GetScenarioName()) +
		"}";

		m_RestClient.Post("api/status/match/start", json);
	}

	//------------------------------------------------------------------------------------------------
	void SendMatchEnd(string winningFaction = "")
	{
		if (!IsStatsReady())
			return;

		if (m_sCurrentMatchId.IsEmpty())
			return;

		string json = "{" +
			MDST_Json.PairString("external_match_id", m_sCurrentMatchId) + "," +
			MDST_Json.PairString("winning_faction", winningFaction) +
		"}";

		m_RestClient.Post("api/status/match/end", json);
	}

	//------------------------------------------------------------------------------------------------
	void SendModList(array<ref MDST_ModInfo> mods)
	{
		if (!IsStatsReady())
			return;

		string json = "{\"mods\":[";

		for (int i = 0; i < mods.Count(); i++)
		{
			if (i > 0)
				json += ",";

			json += mods[i].ToJson();
		}

		json += "]}";
		m_RestClient.Post("api/status/mods", json);
	}

	//------------------------------------------------------------------------------------------------
	protected string GetScenarioName()
	{
		if (!m_sScenarioName.IsEmpty())
			return m_sScenarioName;

		return "unknown";
	}

	//------------------------------------------------------------------------------------------------
	protected string BuildMatchId()
	{
		int uptimeSeconds = Math.Round(GetGame().GetWorld().GetWorldTime() * 0.001);
		return string.Format("%1-%2", m_sServerId, uptimeSeconds);
	}

	//------------------------------------------------------------------------------------------------
	protected void GetPlayersNearPosition(vector position, float radiusMeters, notnull array<int> outPlayerIds)
	{
		PlayerManager playerManager = GetGame().GetPlayerManager();
		if (!playerManager)
			return;

		array<int> playerIds = {};
		playerManager.GetPlayers(playerIds);

		foreach (int playerId : playerIds)
		{
			IEntity playerEntity = playerManager.GetPlayerControlledEntity(playerId);
			if (!playerEntity)
				continue;

			float distance = vector.Distance(playerEntity.GetOrigin(), position);
			if (distance <= radiusMeters)
				outPlayerIds.Insert(playerId);
		}
	}

	//------------------------------------------------------------------------------------------------
	static MDST_StatsGameModeComponent GetInstance()
	{
		BaseGameMode gameMode = GetGame().GetGameMode();
		if (!gameMode)
			return null;

		return MDST_StatsGameModeComponent.Cast(gameMode.FindComponent(MDST_StatsGameModeComponent));
	}
}
