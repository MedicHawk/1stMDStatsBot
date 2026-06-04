//------------------------------------------------------------------------------------------------
//! Runtime JSON mod list for 1stMD Stats Bot.
//! Stored in the active server profile so hosted servers can publish mod metadata without Workbench.
//------------------------------------------------------------------------------------------------

class MDST_ModRuntimeInfo : JsonApiStruct
{
	string mod_id;
	string name;
	string version;
	bool required = true;

	void MDST_ModRuntimeInfo(string modId = "", string modName = "", string modVersion = "", bool isRequired = true)
	{
		RegV("mod_id");
		RegV("name");
		RegV("version");
		RegV("required");

		mod_id = modId;
		name = modName;
		version = modVersion;
		required = isRequired;
	}

	bool IsUsable()
	{
		return !mod_id.IsEmpty();
	}
}

class MDST_ModsRuntimeConfig : JsonApiStruct
{
	static const string CONFIG_PATH = "$profile:MDST_StatsBot_Mods.json";

	ref array<ref MDST_ModRuntimeInfo> mods = {};

	void MDST_ModsRuntimeConfig()
	{
		RegV("mods");
	}

	bool LoadOrCreate()
	{
		if (LoadFromFile(CONFIG_PATH))
		{
			if (!mods)
				mods = {};

			Print(string.Format("[1stMD Stats] Loaded runtime mod list from %1 count=%2", CONFIG_PATH, mods.Count()), LogLevel.NORMAL);
			return true;
		}

		SetDefaults();

		if (PackToFile(CONFIG_PATH))
		{
			Print(string.Format("[1stMD Stats] Created runtime mod list at %1. Edit it and restart the server to publish your real mod list.", CONFIG_PATH), LogLevel.WARNING);
			return true;
		}

		Print(string.Format("[1stMD Stats] Failed to load or create runtime mod list at %1", CONFIG_PATH), LogLevel.ERROR);
		return false;
	}

	void SetDefaults()
	{
		if (!mods)
			mods = {};

		if (mods.Count() == 0)
			mods.Insert(new MDST_ModRuntimeInfo("1stMDStatsBot", "1stMD Stats Bot", "", true));
	}

	void ToModInfos(notnull array<ref MDST_ModInfo> outMods)
	{
		outMods.Clear();

		if (!mods)
			return;

		foreach (MDST_ModRuntimeInfo runtimeMod : mods)
		{
			if (!runtimeMod || !runtimeMod.IsUsable())
				continue;

			string modName = runtimeMod.name;
			if (modName.IsEmpty())
				modName = runtimeMod.mod_id;

			outMods.Insert(new MDST_ModInfo(runtimeMod.mod_id, modName, runtimeMod.version, runtimeMod.required));
		}
	}
}

modded class MDST_StatsGameModeComponent
{
	override void OnPostInit(IEntity owner)
	{
		super.OnPostInit(owner);

		if (!GetGame().InPlayMode())
			return;

		RplComponent rpl = RplComponent.Cast(owner.FindComponent(RplComponent));
		if (rpl && !rpl.IsMaster())
			return;

		GetGame().GetCallqueue().CallLater(MDST_SendConfiguredModList, 9000, false);
	}

	void MDST_SendConfiguredModList()
	{
		if (!IsStatsReady())
		{
			Print("[1stMD Stats] Runtime mod list send skipped because stats are not ready.", LogLevel.WARNING);
			return;
		}

		MDST_ModsRuntimeConfig config = new MDST_ModsRuntimeConfig();
		if (!config.LoadOrCreate())
			return;

		array<ref MDST_ModInfo> configuredMods = {};
		config.ToModInfos(configuredMods);

		if (configuredMods.Count() == 0)
		{
			Print("[1stMD Stats] Runtime mod list is empty; no mod status was sent.", LogLevel.NORMAL);
			return;
		}

		SendModList(configuredMods);
		Print(string.Format("[1stMD Stats] Runtime mod list sent count=%1", configuredMods.Count()), LogLevel.NORMAL);
	}
}
