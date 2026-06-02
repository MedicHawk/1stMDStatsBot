//------------------------------------------------------------------------------------------------
//! Periodic movement sampler.
//! Samples every 5-10 seconds, rejects dead/teleport/impossible movement, and sends foot/vehicle totals separately.
//------------------------------------------------------------------------------------------------

class MDST_PlayerMovementState
{
	vector m_vLastPosition;
	bool m_bHasLastPosition;

	void MDST_PlayerMovementState(vector position)
	{
		m_vLastPosition = position;
		m_bHasLastPosition = true;
	}
}

class MDST_MovementTracker
{
	protected ref map<int, ref MDST_PlayerMovementState> m_mPlayerStates = new map<int, ref MDST_PlayerMovementState>();
	protected ref MDST_PlayerIdentityService m_IdentityService;
	protected ref MDST_StatsRestClient m_RestClient;

	protected float m_fSampleSeconds;
	protected float m_fMaxFootMetersPerSecond;
	protected float m_fMaxVehicleMetersPerSecond;

	void MDST_MovementTracker(MDST_StatsRestClient restClient, MDST_PlayerIdentityService identityService, float sampleSeconds)
	{
		m_RestClient = restClient;
		m_IdentityService = identityService;
		m_fSampleSeconds = sampleSeconds;
		m_fMaxFootMetersPerSecond = 12.0;
		m_fMaxVehicleMetersPerSecond = 95.0;
	}

	void Sample()
	{
		PlayerManager playerManager = GetGame().GetPlayerManager();
		if (!playerManager)
			return;

		array<int> playerIds = {};
		playerManager.GetPlayers(playerIds);

		foreach (int playerId : playerIds)
		{
			SamplePlayer(playerManager, playerId);
		}
	}

	protected void SamplePlayer(PlayerManager playerManager, int playerId)
	{
		IEntity entity = playerManager.GetPlayerControlledEntity(playerId);
		if (!entity)
			return;

		if (!IsPlayerAlive(entity))
			return;

		vector currentPosition = entity.GetOrigin();
		MDST_PlayerMovementState state = m_mPlayerStates.Get(playerId);

		if (!state)
		{
			m_mPlayerStates.Set(playerId, new MDST_PlayerMovementState(currentPosition));
			return;
		}

		float distance = vector.Distance(state.m_vLastPosition, currentPosition);
		bool inVehicle = IsInVehicle(entity);
		float maxDistance = m_fSampleSeconds * m_fMaxFootMetersPerSecond;

		if (inVehicle)
			maxDistance = m_fSampleSeconds * m_fMaxVehicleMetersPerSecond;

		state.m_vLastPosition = currentPosition;

		if (distance <= 0.25)
			return;

		if (distance > maxDistance)
		{
			Print(string.Format("[1stMD Stats] Ignored movement spike player=%1 distance=%2 max=%3", playerId, distance, maxDistance), LogLevel.VERBOSE);
			return;
		}

		MDST_PlayerIdentity identity = m_IdentityService.Resolve(playerId);
		if (!identity || !identity.IsValid())
			return;

		float footMeters = 0;
		float vehicleMeters = 0;
		int footSeconds = 0;
		int mountedSeconds = 0;

		if (inVehicle)
		{
			vehicleMeters = distance;
			mountedSeconds = Math.Round(m_fSampleSeconds);
		}
		else
		{
			footMeters = distance;
			footSeconds = Math.Round(m_fSampleSeconds);
		}

		string json = "{" +
			MDST_Json.PairString("player_reforger_id", identity.m_sStableId) + "," +
			MDST_Json.PairString("player_name", identity.m_sDisplayName) + "," +
			MDST_Json.PairFloat("distance_foot_meters", footMeters) + "," +
			MDST_Json.PairFloat("distance_vehicle_meters", vehicleMeters) + "," +
			MDST_Json.PairFloat("sprint_distance_meters", 0) + "," +
			MDST_Json.PairFloat("swim_distance_meters", 0) + "," +
			MDST_Json.PairInt("time_on_foot_seconds", footSeconds) + "," +
			MDST_Json.PairInt("time_mounted_seconds", mountedSeconds) +
		"}";

		m_RestClient.Post("api/ingest/movement", json);
	}

	protected bool IsPlayerAlive(IEntity entity)
	{
		DamageManagerComponent damageManager = DamageManagerComponent.Cast(entity.FindComponent(DamageManagerComponent));
		if (!damageManager)
			return true;

		return damageManager.GetState() != EDamageState.DESTROYED;
	}

	protected bool IsInVehicle(IEntity entity)
	{
		// TODO: Swap this for your preferred compartment/vehicle ownership test once vehicle telemetry is finalized.
		IEntity parent = entity.GetParent();
		return parent != null;
	}
}
