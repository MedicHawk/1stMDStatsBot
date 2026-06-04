//------------------------------------------------------------------------------------------------
//! Runtime JSON config for 1stMD Stats Bot.
//! Stored in the active server profile so hosted servers can edit credentials without Workbench.
//------------------------------------------------------------------------------------------------

class MDST_StatsServerConfig : JsonApiStruct
{
	static const string CONFIG_PATH = "$profile:MDST_StatsBot_Config.json";

	bool enabled = true;
	string api_base_url = "http://207.49.100.200/";
	string server_id = "hosted-main";
	string api_key = "replace_with_server_api_key";
	float movement_sample_seconds = 10;
	float heartbeat_seconds = 30;
	float queue_flush_seconds = 15;
	float telemetry_log_seconds = 60;
	string scenario_name = "unknown";
	int max_player_slots = 64;

	void MDST_StatsServerConfig()
	{
		RegV("enabled");
		RegV("api_base_url");
		RegV("server_id");
		RegV("api_key");
		RegV("movement_sample_seconds");
		RegV("heartbeat_seconds");
		RegV("queue_flush_seconds");
		RegV("telemetry_log_seconds");
		RegV("scenario_name");
		RegV("max_player_slots");
	}

	void SetDefaults(bool statsEnabled, string apiBaseUrl, string serverId, string apiKey, float movementSampleSeconds, float heartbeatSeconds, float queueFlushSeconds, float telemetryLogSeconds, string scenarioName, int maxPlayerSlots)
	{
		enabled = statsEnabled;
		api_base_url = apiBaseUrl;
		server_id = serverId;
		api_key = apiKey;
		movement_sample_seconds = movementSampleSeconds;
		heartbeat_seconds = heartbeatSeconds;
		queue_flush_seconds = queueFlushSeconds;
		telemetry_log_seconds = telemetryLogSeconds;
		scenario_name = scenarioName;
		max_player_slots = maxPlayerSlots;
	}

	bool LoadOrCreate()
	{
		if (LoadFromFile(CONFIG_PATH))
		{
			Print(string.Format("[1stMD Stats] Loaded runtime config from %1", CONFIG_PATH), LogLevel.NORMAL);
			return true;
		}

		if (PackToFile(CONFIG_PATH))
		{
			Print(string.Format("[1stMD Stats] Created runtime config at %1. Edit it and restart the server if values are placeholders.", CONFIG_PATH), LogLevel.WARNING);
			return true;
		}

		Print(string.Format("[1stMD Stats] Failed to load or create runtime config at %1", CONFIG_PATH), LogLevel.ERROR);
		return false;
	}

	bool HasUsableServerConfig()
	{
		return enabled && !api_base_url.IsEmpty() && !server_id.IsEmpty() && !api_key.IsEmpty() && api_key != "replace_with_server_api_key";
	}
}
