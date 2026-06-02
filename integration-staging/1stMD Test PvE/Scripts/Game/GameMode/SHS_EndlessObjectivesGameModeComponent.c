//------------------------------------------------------------------------------------------------
//! SHS Endless Objectives Game Mode Component
//! Manages never-ending dynamic objectives based on map locations
//! Designed for quick setup on any map - just add this component to your game mode
//! 
//! Features:
//! - Auto-discovers towns/cities/locations on ANY map
//! - Up to 10 concurrent objectives
//! - Max 300 AI with dynamic spawning
//! - Dynamic difficulty based on player performance
//! - Counter-attacks that hunt players
//! - Enemy vehicle convoys
//! - Civilian population with ROE considerations
//! - Ambient vehicle traffic
//! - Zero manual placement required
//------------------------------------------------------------------------------------------------

[ComponentEditorProps(category: "SHS/GameMode", description: "Endless Objectives PVE Game Mode - Works on any map!")]
class SHS_EndlessObjectivesGameModeComponentClass : SCR_BaseGameModeComponentClass
{
}

class SHS_EndlessObjectivesGameModeComponent : SCR_BaseGameModeComponent
{
	//------------------------------------------------------------------------------------------------
	// CONFIGURABLE SETTINGS - Exposed to World Editor for easy setup
	//------------------------------------------------------------------------------------------------
	
	[Attribute(defvalue: "10", UIWidgets.Slider, desc: "Maximum active objectives at once", params: "1 20 1", category: "Objectives")]
	protected int m_iMaxActiveObjectives;
	
	[Attribute(defvalue: "300", UIWidgets.Slider, desc: "Maximum AI units in the world", params: "50 500 10", category: "AI")]
	protected int m_iMaxTotalAI;
	
	[Attribute(defvalue: "25", UIWidgets.Slider, desc: "Base AI per objective", params: "5 100 5", category: "AI")]
	protected int m_iBaseAIPerObjective;
	
	[Attribute(defvalue: "500", UIWidgets.Slider, desc: "Minimum distance between objectives (meters)", params: "100 2000 100", category: "Objectives")]
	protected float m_fMinObjectiveDistance;
	
	[Attribute(defvalue: "100", UIWidgets.Slider, desc: "Minimum distance from players for new objectives (0 to disable)", params: "0 5000 100", category: "Objectives")]
	protected float m_fMinPlayerDistance;
	
	[Attribute(defvalue: "250", UIWidgets.Slider, desc: "Radius for 1stMD Stats objective completion credit", params: "50 1000 50", category: "Objectives")]
	protected float m_fStatsObjectiveCreditRadius;
	
	[Attribute(defvalue: "250", UIWidgets.Slider, desc: "Radius for 1stMD Stats AI kill participation credit", params: "50 1000 50", category: "Objectives")]
	protected float m_fStatsAIKillCreditRadius;
	
	[Attribute(defvalue: "30", UIWidgets.Slider, desc: "Seconds between objective checks", params: "10 120 5", category: "System")]
	protected float m_fObjectiveCheckInterval;
	
	[Attribute(defvalue: "1", UIWidgets.CheckBox, desc: "Enable objective markers on map", category: "UI")]
	protected bool m_bShowMapMarkers;
	
	[Attribute(defvalue: "1", UIWidgets.CheckBox, desc: "Scale AI count based on player count", category: "AI")]
	protected bool m_bScaleAIWithPlayers;
	
	[Attribute(defvalue: "0.5", UIWidgets.Slider, desc: "Additional AI per player (multiplier)", params: "0.1 2.0 0.1", category: "AI")]
	protected float m_fAIPlayerMultiplier;
	
	[Attribute(defvalue: "FIA", UIWidgets.EditBox, desc: "Enemy AI faction key (e.g., FIA, USSR)", category: "Factions")]
	protected string m_sEnemyFactionKey;
	
	[Attribute(defvalue: "US", UIWidgets.EditBox, desc: "Player faction 1 (e.g., US)", category: "Factions")]
	protected string m_sPlayerFaction1;
	
	[Attribute(defvalue: "USSR", UIWidgets.EditBox, desc: "Player faction 2 for PVPVE (leave empty for PVE only)", category: "Factions")]
	protected string m_sPlayerFaction2;
	
	[Attribute(defvalue: "1", UIWidgets.CheckBox, desc: "Enable PVPVE mode (two player factions vs AI)", category: "Factions")]
	protected bool m_bPVPVEEnabled;
	
	// Location type filters - what kind of places to use for objectives
	[Attribute(defvalue: "1", UIWidgets.CheckBox, desc: "Include Cities", category: "Location Filters")]
	protected bool m_bIncludeCities;
	
	[Attribute(defvalue: "1", UIWidgets.CheckBox, desc: "Include Towns", category: "Location Filters")]
	protected bool m_bIncludeTowns;
	
	[Attribute(defvalue: "1", UIWidgets.CheckBox, desc: "Include Villages", category: "Location Filters")]
	protected bool m_bIncludeVillages;
	
	[Attribute(defvalue: "1", UIWidgets.CheckBox, desc: "Include Military Bases", category: "Location Filters")]
	protected bool m_bIncludeMilitaryBases;
	
	[Attribute(defvalue: "0", UIWidgets.CheckBox, desc: "Include Named Locations (hills, forests)", category: "Location Filters")]
	protected bool m_bIncludeNamedLocations;
	
	[Attribute(defvalue: "1", UIWidgets.CheckBox, desc: "Generate random locations across the map", category: "Location Filters")]
	protected bool m_bGenerateRandomLocations;
	
	[Attribute(defvalue: "50", UIWidgets.Slider, desc: "Number of random locations to generate", params: "10 200 10", category: "Location Filters")]
	protected int m_iRandomLocationCount;
	
	// AI Group Prefabs - what to spawn
	[Attribute(defvalue: "", UIWidgets.ResourcePickerThumbnail, desc: "AI Group prefabs to spawn (leave empty for auto-detect)", params: "et", category: "AI Prefabs")]
	protected ref array<ResourceName> m_aAIGroupPrefabs;
	
	// Difficulty settings
	[Attribute(defvalue: "1", UIWidgets.CheckBox, desc: "Enable dynamic difficulty adjustment", category: "Difficulty")]
	protected bool m_bDynamicDifficulty;
	
	[Attribute(defvalue: "0.5", UIWidgets.Slider, desc: "Starting difficulty (0-1)", params: "0.1 1.0 0.1", category: "Difficulty")]
	protected float m_fStartingDifficulty;
	
	// Counter Attack settings
	[Attribute(defvalue: "1", UIWidgets.CheckBox, desc: "Enable counter-attacks that hunt players", category: "Counter Attacks")]
	protected bool m_bEnableCounterAttacks;
	
	[Attribute(defvalue: "180", UIWidgets.Slider, desc: "Minimum seconds between counter-attacks", params: "60 600 30", category: "Counter Attacks")]
	protected float m_fCounterAttackMinInterval;
	
	[Attribute(defvalue: "0.25", UIWidgets.Slider, desc: "Base chance for counter-attack per check (0-1)", params: "0.05 0.5 0.05", category: "Counter Attacks")]
	protected float m_fCounterAttackChance;
	
	[Attribute(defvalue: "3", UIWidgets.Slider, desc: "Maximum simultaneous counter-attacks", params: "1 5 1", category: "Counter Attacks")]
	protected int m_iMaxCounterAttacks;
	
	[Attribute(defvalue: "6", UIWidgets.Slider, desc: "Minimum AI per counter-attack squad", params: "2 15 1", category: "Counter Attacks")]
	protected int m_iCounterAttackMinAI;
	
	[Attribute(defvalue: "15", UIWidgets.Slider, desc: "Maximum AI per counter-attack squad", params: "5 30 1", category: "Counter Attacks")]
	protected int m_iCounterAttackMaxAI;
	
	// Vehicle Convoy settings
	[Attribute(defvalue: "1", UIWidgets.CheckBox, desc: "Enable enemy vehicle convoys", category: "Convoys")]
	protected bool m_bEnableConvoys;
	
	[Attribute(defvalue: "3", UIWidgets.Slider, desc: "Maximum active convoys", params: "1 5 1", category: "Convoys")]
	protected int m_iMaxConvoys;
	
	[Attribute(defvalue: "300", UIWidgets.Slider, desc: "Seconds between convoy spawns", params: "60 900 30", category: "Convoys")]
	protected float m_fConvoySpawnInterval;
	
	[Attribute(defvalue: "2", UIWidgets.Slider, desc: "Minimum vehicles per convoy", params: "1 5 1", category: "Convoys")]
	protected int m_iMinConvoyVehicles;
	
	[Attribute(defvalue: "5", UIWidgets.Slider, desc: "Maximum vehicles per convoy", params: "2 10 1", category: "Convoys")]
	protected int m_iMaxConvoyVehicles;
	
	// Civilian settings
	[Attribute(defvalue: "1", UIWidgets.CheckBox, desc: "Enable civilian population", category: "Civilians")]
	protected bool m_bEnableCivilians;
	
	[Attribute(defvalue: "150", UIWidgets.Slider, desc: "Maximum civilian NPCs", params: "10 300 10", category: "Civilians")]
	protected int m_iMaxCivilians;
	
	[Attribute(defvalue: "8", UIWidgets.Slider, desc: "Civilians per named location", params: "2 20 1", category: "Civilians")]
	protected int m_iCiviliansPerLocation;
	
	[Attribute(defvalue: "1", UIWidgets.CheckBox, desc: "Penalize civilian kills (ROE)", category: "Civilians")]
	protected bool m_bPenalizeCivilianKills;
	
	// Ambient Traffic settings
	[Attribute(defvalue: "1", UIWidgets.CheckBox, desc: "Enable ambient vehicle traffic", category: "Ambient Traffic")]
	protected bool m_bEnableAmbientTraffic;
	
	[Attribute(defvalue: "10", UIWidgets.Slider, desc: "Maximum traffic entities", params: "5 20 1", category: "Ambient Traffic")]
	protected int m_iMaxTrafficEntities;
	
	[Attribute(defvalue: "120", UIWidgets.Slider, desc: "Seconds between traffic spawns", params: "30 300 15", category: "Ambient Traffic")]
	protected float m_fTrafficSpawnInterval;
	
	[Attribute(defvalue: "0.4", UIWidgets.Slider, desc: "Civilian traffic percentage (0-1)", params: "0 1 0.1", category: "Ambient Traffic")]
	protected float m_fCivilianTrafficChance;
	
	[Attribute(defvalue: "0.3", UIWidgets.Slider, desc: "Military patrol percentage (0-1)", params: "0 1 0.1", category: "Ambient Traffic")]
	protected float m_fMilitaryPatrolChance;
	
	// Minefield settings
	[Attribute(defvalue: "1", UIWidgets.CheckBox, desc: "Enable random minefields at objectives", category: "Minefields")]
	protected bool m_bEnableMinefields;
	
	[Attribute(defvalue: "2", UIWidgets.Slider, desc: "AP minefields per objective", params: "0 10 1", category: "Minefields")]
	protected int m_iAPMinesPerObjective;
	
	[Attribute(defvalue: "1", UIWidgets.Slider, desc: "AT minefields per objective", params: "0 5 1", category: "Minefields")]
	protected int m_iATMinesPerObjective;
	
	[Attribute(defvalue: "80", UIWidgets.Slider, desc: "Minefield radius around objective (meters)", params: "30 150 10", category: "Minefields")]
	protected float m_fMineFieldRadius;
	
	[Attribute(defvalue: "1", UIWidgets.CheckBox, desc: "Show minefield warning notifications", category: "Minefields")]
	protected bool m_bShowMineFieldWarnings;
	
	// Performance Management settings
	[Attribute(defvalue: "1", UIWidgets.CheckBox, desc: "Enable automatic performance management", category: "Performance")]
	protected bool m_bEnablePerformanceManager;
	
	[Attribute(defvalue: "30", UIWidgets.Slider, desc: "Target server FPS", params: "15 60 5", category: "Performance")]
	protected float m_fTargetFPS;
	
	[Attribute(defvalue: "25", UIWidgets.Slider, desc: "Warning FPS threshold (stop spawning)", params: "10 50 5", category: "Performance")]
	protected float m_fWarningFPS;
	
	[Attribute(defvalue: "20", UIWidgets.Slider, desc: "Critical FPS threshold (reduce AI)", params: "5 40 5", category: "Performance")]
	protected float m_fCriticalFPS;
	
	[Attribute(defvalue: "50", UIWidgets.Slider, desc: "Minimum AI cap (never go below)", params: "20 100 10", category: "Performance")]
	protected int m_iMinimumAICap;
	
	[Attribute(defvalue: "25", UIWidgets.Slider, desc: "AI adjustment step size", params: "10 50 5", category: "Performance")]
	protected int m_iAIAdjustStep;
	
	//------------------------------------------------------------------------------------------------
	// INTERNAL STATE
	//------------------------------------------------------------------------------------------------
	
	protected ref SHS_LocationDiscovery m_LocationDiscovery;
	protected ref SHS_ObjectiveManager m_ObjectiveManager;
	protected ref SHS_AIManager m_AIManager;
	protected ref SHS_DifficultyManager m_DifficultyManager;
	protected ref SHS_CounterAttackManager m_CounterAttackManager;
	protected ref SHS_ConvoyManager m_ConvoyManager;
	protected ref SHS_CivilianManager m_CivilianManager;
	protected ref SHS_AmbientTrafficManager m_TrafficManager;
	protected ref SHS_PerformanceManager m_PerformanceManager;
	protected ref SHS_MineManager m_MineManager;
	
	protected bool m_bInitialized = false;
	protected float m_fLastCheckTime = 0;
	protected float m_fTimeSinceLastCheck = 0;
	
	// Statistics tracking
	protected int m_iObjectivesCompleted = 0;
	protected int m_iTotalAIKilled = 0;
	protected int m_iTotalPlayerDeaths = 0;
	
	//------------------------------------------------------------------------------------------------
	// GETTERS FOR OTHER SYSTEMS
	//------------------------------------------------------------------------------------------------
	
	int GetMaxActiveObjectives() { return m_iMaxActiveObjectives; }
	int GetMaxTotalAI() { return m_iMaxTotalAI; }
	int GetBaseAIPerObjective() { return m_iBaseAIPerObjective; }
	float GetMinObjectiveDistance() { return m_fMinObjectiveDistance; }
	float GetMinPlayerDistance() { return m_fMinPlayerDistance; }
	bool GetShowMapMarkers() { return m_bShowMapMarkers; }
	string GetEnemyFactionKey() { return m_sEnemyFactionKey; }
	string GetPlayerFaction1() { return m_sPlayerFaction1; }
	string GetPlayerFaction2() { return m_sPlayerFaction2; }
	bool IsPVPVEEnabled() { return m_bPVPVEEnabled; }
	
	SHS_LocationDiscovery GetLocationDiscovery() { return m_LocationDiscovery; }
	SHS_ObjectiveManager GetObjectiveManager() { return m_ObjectiveManager; }
	SHS_AIManager GetAIManager() { return m_AIManager; }
	SHS_DifficultyManager GetDifficultyManager() { return m_DifficultyManager; }
	SHS_CounterAttackManager GetCounterAttackManager() { return m_CounterAttackManager; }
	SHS_ConvoyManager GetConvoyManager() { return m_ConvoyManager; }
	SHS_CivilianManager GetCivilianManager() { return m_CivilianManager; }
	SHS_AmbientTrafficManager GetTrafficManager() { return m_TrafficManager; }
	SHS_PerformanceManager GetPerformanceManager() { return m_PerformanceManager; }
	SHS_MineManager GetMineManager() { return m_MineManager; }
	
	int GetObjectivesCompleted() { return m_iObjectivesCompleted; }
	int GetTotalAIKilled() { return m_iTotalAIKilled; }
	
	//------------------------------------------------------------------------------------------------
	// INITIALIZATION
	//------------------------------------------------------------------------------------------------
	
	override void OnPostInit(IEntity owner)
	{
		super.OnPostInit(owner);
		
		if (!GetGame().InPlayMode())
			return;
		
		// Only run on server/authority
		RplComponent rpl = RplComponent.Cast(owner.FindComponent(RplComponent));
		if (rpl && !rpl.IsMaster())
			return;
		
		SetEventMask(owner, EntityEvent.FRAME);
		
		// Delay initialization to ensure world is fully loaded
		GetGame().GetCallqueue().CallLater(Initialize, 5000, false);
	}
	
	//------------------------------------------------------------------------------------------------
	protected void Initialize()
	{
		Print("[SHS-Endless] ========================================", LogLevel.NORMAL);
		Print("[SHS-Endless] Initializing Endless Objectives System...", LogLevel.NORMAL);
		
		// Log game mode type
		if (m_bPVPVEEnabled)
		{
			Print(string.Format("[SHS-Endless] Mode: PVPVE (%1 vs %2 vs %3 AI)", m_sPlayerFaction1, m_sPlayerFaction2, m_sEnemyFactionKey), LogLevel.NORMAL);
		}
		else
		{
			Print(string.Format("[SHS-Endless] Mode: PVE (%1 vs %2 AI)", m_sPlayerFaction1, m_sEnemyFactionKey), LogLevel.NORMAL);
		}
		
		Print("[SHS-Endless] ========================================", LogLevel.NORMAL);
		
		// Create the difficulty manager first
		m_DifficultyManager = new SHS_DifficultyManager(m_fStartingDifficulty, m_bDynamicDifficulty);
		
		// Create AI manager (uses faction entity catalog automatically)
		m_AIManager = new SHS_AIManager(m_iMaxTotalAI, m_sEnemyFactionKey);
		
		// Create location discovery
		m_LocationDiscovery = new SHS_LocationDiscovery();
		m_LocationDiscovery.SetFilters(m_bIncludeCities, m_bIncludeTowns, m_bIncludeVillages, 
									   m_bIncludeMilitaryBases, m_bIncludeNamedLocations);
		m_LocationDiscovery.SetRandomLocationGeneration(m_bGenerateRandomLocations, m_iRandomLocationCount);
		
		// Discover all locations on the map
		int locationCount = m_LocationDiscovery.DiscoverLocations();
		Print(string.Format("[SHS-Endless] Discovered %1 valid locations on map", locationCount), LogLevel.NORMAL);
		
		if (locationCount == 0)
		{
			Print("[SHS-Endless] WARNING: No locations found! Check filter settings or map compatibility.", LogLevel.WARNING);
			return;
		}
		
		// Check if we have AI prefabs
		if (m_AIManager.GetPrefabCount() == 0)
		{
			Print("[SHS-Endless] WARNING: No AI group prefabs found! Add them in component settings.", LogLevel.WARNING);
			Print("[SHS-Endless] Go to the component and add prefabs to 'AI Group Prefabs' array.", LogLevel.WARNING);
			return;
		}
		
		// Create objective manager (needs location discovery and AI manager)
		m_ObjectiveManager = new SHS_ObjectiveManager(this);
		
		// Initialize subsystems
		InitializePerformanceManager();
		InitializeCounterAttacks();
		InitializeConvoys();
		InitializeCivilians();
		InitializeAmbientTraffic();
		InitializeMinefields();
		
		// Spawn initial objectives
		int initialCount = Math.Min(m_iMaxActiveObjectives, locationCount);
		Print(string.Format("[SHS-Endless] Spawning %1 initial objectives...", initialCount), LogLevel.NORMAL);
		
		for (int i = 0; i < initialCount; i++)
		{
			// Stagger initial spawns
			GetGame().GetCallqueue().CallLater(TrySpawnNewObjective, i * 3000, false);
		}
		
		m_bInitialized = true;
		Print("[SHS-Endless] System initialized successfully!", LogLevel.NORMAL);
		Print("[SHS-Endless] ========================================", LogLevel.NORMAL);
	}
	
	//------------------------------------------------------------------------------------------------
	protected void InitializePerformanceManager()
	{
		if (m_bEnablePerformanceManager)
		{
			m_PerformanceManager = new SHS_PerformanceManager(this, m_iMaxTotalAI);
			m_PerformanceManager.Configure(
				m_fTargetFPS,
				m_fWarningFPS,
				m_fCriticalFPS,
				40.0,  // Excellent FPS threshold
				m_iMinimumAICap,
				m_iAIAdjustStep,
				30.0,  // Adjust cooldown seconds
				false  // Verbose logging
			);
			Print("[SHS-Endless] Performance Manager ENABLED", LogLevel.NORMAL);
		}
		else
		{
			Print("[SHS-Endless] Performance Manager DISABLED", LogLevel.NORMAL);
		}
	}
	
	//------------------------------------------------------------------------------------------------
	protected void InitializeCounterAttacks()
	{
		if (m_bEnableCounterAttacks)
		{
			m_CounterAttackManager = new SHS_CounterAttackManager(this, m_AIManager);
			m_CounterAttackManager.Configure(
				true,
				m_fCounterAttackMinInterval,
				m_fCounterAttackChance,
				m_iCounterAttackMinAI,
				m_iCounterAttackMaxAI,
				0.4,  // QRF chance on objective complete
				m_iMaxCounterAttacks
			);
			Print("[SHS-Endless] Counter-attacks ENABLED", LogLevel.NORMAL);
		}
		else
		{
			Print("[SHS-Endless] Counter-attacks DISABLED", LogLevel.NORMAL);
		}
	}
	
	//------------------------------------------------------------------------------------------------
	protected void InitializeConvoys()
	{
		if (m_bEnableConvoys)
		{
			m_ConvoyManager = new SHS_ConvoyManager(this, m_AIManager, m_sEnemyFactionKey);
			m_ConvoyManager.Configure(true, m_fConvoySpawnInterval, m_iMaxConvoys, m_iMinConvoyVehicles, m_iMaxConvoyVehicles);
			Print("[SHS-Endless] Vehicle convoys ENABLED", LogLevel.NORMAL);
		}
		else
		{
			Print("[SHS-Endless] Vehicle convoys DISABLED", LogLevel.NORMAL);
		}
	}
	
	//------------------------------------------------------------------------------------------------
	protected void InitializeCivilians()
	{
		if (m_bEnableCivilians)
		{
			m_CivilianManager = new SHS_CivilianManager(this);
			m_CivilianManager.Configure(true, m_iMaxCivilians, m_iCiviliansPerLocation, m_bPenalizeCivilianKills, 100);
			Print("[SHS-Endless] Civilian population ENABLED", LogLevel.NORMAL);
		}
		else
		{
			Print("[SHS-Endless] Civilian population DISABLED", LogLevel.NORMAL);
		}
	}
	
	//------------------------------------------------------------------------------------------------
	protected void InitializeAmbientTraffic()
	{
		if (m_bEnableAmbientTraffic)
		{
			m_TrafficManager = new SHS_AmbientTrafficManager(this, m_AIManager, m_sEnemyFactionKey);
			m_TrafficManager.Configure(true, m_iMaxTrafficEntities, m_fTrafficSpawnInterval, m_fCivilianTrafficChance, m_fMilitaryPatrolChance);
			Print("[SHS-Endless] Ambient traffic ENABLED", LogLevel.NORMAL);
		}
		else
		{
			Print("[SHS-Endless] Ambient traffic DISABLED", LogLevel.NORMAL);
		}
	}
	
	//------------------------------------------------------------------------------------------------
	protected void InitializeMinefields()
	{
		if (m_bEnableMinefields)
		{
			m_MineManager = new SHS_MineManager(this);
			m_MineManager.Configure(true, m_iAPMinesPerObjective, m_iATMinesPerObjective, m_fMineFieldRadius, m_bShowMineFieldWarnings);
			m_MineManager.SetFactionMines(m_sEnemyFactionKey);
			Print("[SHS-Endless] Minefields ENABLED", LogLevel.NORMAL);
		}
		else
		{
			Print("[SHS-Endless] Minefields DISABLED", LogLevel.NORMAL);
		}
	}
	
	//------------------------------------------------------------------------------------------------
	// MAIN UPDATE LOOP
	//------------------------------------------------------------------------------------------------
	
	override void EOnFrame(IEntity owner, float timeSlice)
	{
		if (!m_bInitialized)
			return;
		
		// Update performance manager every frame (needs accurate frame time samples)
		if (m_PerformanceManager)
			m_PerformanceManager.Update(timeSlice);
		
		m_fTimeSinceLastCheck += timeSlice;
		
		if (m_fTimeSinceLastCheck < m_fObjectiveCheckInterval)
			return;
		
		m_fTimeSinceLastCheck = 0;
		
		// Update the system
		UpdateObjectives();
	}
	
	//------------------------------------------------------------------------------------------------
	protected void UpdateObjectives()
	{
		if (!m_ObjectiveManager || !m_AIManager)
			return;
		
		// Clean up dead AI
		int cleaned = m_AIManager.CleanupDeadAI();
		if (cleaned > 0)
		{
			m_iTotalAIKilled += cleaned;
			m_DifficultyManager.OnAIKilled(cleaned);
			ReportStatsAIKillsNearObjectives(cleaned);
		}
		
		// Update all subsystems
		if (m_CounterAttackManager)
			m_CounterAttackManager.Update(m_fObjectiveCheckInterval);
		
		if (m_ConvoyManager)
			m_ConvoyManager.Update(m_fObjectiveCheckInterval);
		
		if (m_CivilianManager)
			m_CivilianManager.Update(m_fObjectiveCheckInterval);
		
		if (m_TrafficManager)
			m_TrafficManager.Update(m_fObjectiveCheckInterval);
		
		// Update all objectives
		m_ObjectiveManager.UpdateObjectives();
		
		// Check for completed objectives
		array<ref SHS_EndlessObjective> completedList = {};
		m_ObjectiveManager.GetCompletedObjectives(completedList);
		
		foreach (SHS_EndlessObjective obj : completedList)
		{
			OnObjectiveCompleted(obj);
		}
		
		// Spawn new objectives if needed
		int activeCount = m_ObjectiveManager.GetActiveObjectiveCount();
		int needed = m_iMaxActiveObjectives - activeCount;
		
		if (needed > 0)
		{
			Print(string.Format("[SHS-Endless] Need %1 new objectives (Active: %2/%3)", 
				needed, activeCount, m_iMaxActiveObjectives), LogLevel.NORMAL);
		}
		
		for (int i = 0; i < needed; i++)
		{
			// Stagger spawns to prevent hitching
			GetGame().GetCallqueue().CallLater(TrySpawnNewObjective, i * 2000, false);
		}
		
		// Log status periodically
		LogSystemStatus();
	}
	
	//------------------------------------------------------------------------------------------------
	protected void LogSystemStatus()
	{
		float currentDiff = m_DifficultyManager.GetCurrentDifficulty();
		int activeObjectives = m_ObjectiveManager.GetActiveObjectiveCount();
		int currentAI = m_AIManager.GetCurrentAICount();
		int maxAI = m_AIManager.GetMaxAI();
		
		string status = string.Format("[SHS-Endless] Status: %1 objectives, %2/%3 AI, Difficulty: %4", 
			activeObjectives, currentAI, maxAI, currentDiff.ToString());
		
		if (m_PerformanceManager)
		{
			float fps = m_PerformanceManager.GetAverageFPS();
			status += string.Format(", FPS: %1", fps.ToString());
		}
		
		if (m_CounterAttackManager)
			status += string.Format(", Attacks: %1", m_CounterAttackManager.GetActiveCounterAttackCount());
		
		if (m_ConvoyManager)
			status += string.Format(", Convoys: %1", m_ConvoyManager.GetActiveConvoyCount());
		
		if (m_CivilianManager)
			status += string.Format(", Civs: %1", m_CivilianManager.GetTotalCivilianCount());
		
		if (m_TrafficManager)
			status += string.Format(", Traffic: %1", m_TrafficManager.GetActiveTrafficCount());
		
		Print(status, LogLevel.NORMAL);
	}
	
	//------------------------------------------------------------------------------------------------
	protected void TrySpawnNewObjective()
	{
		if (!m_ObjectiveManager || !m_LocationDiscovery || !m_AIManager)
			return;
		
		// Check performance manager - pause spawning if performance is bad
		if (m_PerformanceManager && m_PerformanceManager.ShouldPauseSpawning())
		{
			Print("[SHS-Endless] Spawning paused due to performance", LogLevel.NORMAL);
			return;
		}
		
		// Check if we have prefabs
		if (m_AIManager.GetPrefabCount() == 0)
		{
			Print("[SHS-Endless] Cannot spawn objective - no AI prefabs configured!", LogLevel.ERROR);
			return;
		}
		
		// Get current objective positions
		array<vector> objectivePositions = {};
		m_ObjectiveManager.GetActiveObjectivePositions(objectivePositions);
		
		// Get player positions
		array<vector> playerPositions = {};
		GetAllPlayerPositions(playerPositions);
		
		// Find a valid location
		SHS_DiscoveredLocation location = m_LocationDiscovery.GetRandomAvailableLocation(
			objectivePositions,
			playerPositions,
			m_fMinObjectiveDistance,
			m_fMinPlayerDistance
		);
		
		if (!location)
		{
			Print("[SHS-Endless] No valid location available for new objective", LogLevel.WARNING);
			return;
		}
		
		// Calculate AI count based on difficulty and player count
		int aiCount = CalculateAICount();
		
		// Check if we have AI budget
		if (!m_AIManager.CanSpawnAI(aiCount))
		{
			Print(string.Format("[SHS-Endless] AI cap reached (%1/%2), waiting...", 
				m_AIManager.GetCurrentAICount(), m_iMaxTotalAI), LogLevel.NORMAL);
			return;
		}
		
		// Create the objective
		SHS_EndlessObjective objective = m_ObjectiveManager.CreateObjective(location, aiCount);
		
		if (objective)
		{
			Print(string.Format("[SHS-Endless] NEW OBJECTIVE: %1 (%2 AI) at %3", 
				location.GetName(), aiCount, location.GetPosition().ToString()), LogLevel.NORMAL);
			
			// Spawn minefields at the objective if enabled
			if (m_MineManager)
			{
				m_MineManager.SpawnMineFieldAtObjective(location.GetPosition(), location.GetName());
			}
			
			// Spawn civilians near the objective if enabled (mixed with enemies)
			if (m_CivilianManager && !location.IsMilitary())
			{
				m_CivilianManager.SpawnCiviliansAtLocation(location.GetPosition(), location.GetName());
			}
		}
	}
	
	//------------------------------------------------------------------------------------------------
	protected int CalculateAICount()
	{
		int baseCount = m_iBaseAIPerObjective;
		
		// Scale with difficulty
		float difficultyMod = m_DifficultyManager.GetCurrentDifficulty();
		baseCount = Math.Round(baseCount * (0.5 + difficultyMod * 0.5)); // 50-100% based on difficulty
		
		// Scale with player count if enabled
		if (m_bScaleAIWithPlayers)
		{
			int playerCount = GetPlayerCount();
			if (playerCount > 1)
			{
				baseCount = Math.Round(baseCount * (1 + (playerCount - 1) * m_fAIPlayerMultiplier));
			}
		}
		
		// Clamp to reasonable values
		return Math.Clamp(baseCount, 5, 100);
	}
	
	//------------------------------------------------------------------------------------------------
	protected void OnObjectiveCompleted(SHS_EndlessObjective objective)
	{
		m_iObjectivesCompleted++;
		
		// Notify difficulty manager
		float completionTime = objective.GetCompletionTime();
		int aiKilled = objective.GetAIKilled();
		int playerDeaths = objective.GetPlayerDeaths();
		
		m_DifficultyManager.OnObjectiveCompleted(completionTime, aiKilled, playerDeaths);
		
		// Release the location
		m_LocationDiscovery.ReleaseLocation(objective.GetLocation());
		
		Print(string.Format("[SHS-Endless] OBJECTIVE COMPLETE: %1 (Time: %2s, Killed: %3, Deaths: %4)", 
			objective.GetLocation().GetName(), completionTime.ToString(), aiKilled, playerDeaths), LogLevel.NORMAL);
		
		float newDiff = m_DifficultyManager.GetCurrentDifficulty();
		Print(string.Format("[SHS-Endless] Total completed: %1, New difficulty: %2", 
			m_iObjectivesCompleted, newDiff.ToString()), LogLevel.NORMAL);
		
		// Notify players
		NotifyObjectiveComplete(objective);
		
		// Credit nearby players in the stats backend without coupling this system to API details.
		SCR_BaseGameMode gameMode = SCR_BaseGameMode.Cast(GetGame().GetGameMode());
		if (gameMode)
			gameMode.MDST_RecordObjectiveCompletedNear(objective.GetLocation().GetPosition(), m_fStatsObjectiveCreditRadius);
		
		// Mark civilians at this location as eligible for despawn
		if (m_CivilianManager)
		{
			m_CivilianManager.OnObjectiveComplete(objective.GetLocation().GetPosition());
		}
		
		// Trigger potential counter-attack (QRF response)
		if (m_CounterAttackManager)
		{
			m_CounterAttackManager.OnObjectiveCompleted(objective.GetLocation().GetPosition());
		}
	}
	
	//------------------------------------------------------------------------------------------------
	protected void NotifyObjectiveComplete(SHS_EndlessObjective objective)
	{
		// Broadcast to all players using popup notification
		SHS_ObjectiveNotification.ShowObjectiveComplete(objective.GetLocation().GetName(), objective.GetAIKilled());
	}
	
	//------------------------------------------------------------------------------------------------
	protected void ReportStatsAIKillsNearObjectives(int cleaned)
	{
		SCR_BaseGameMode gameMode = SCR_BaseGameMode.Cast(GetGame().GetGameMode());
		if (!gameMode || !m_ObjectiveManager)
			return;
		
		array<vector> objectivePositions = {};
		m_ObjectiveManager.GetActiveObjectivePositions(objectivePositions);
		
		if (objectivePositions.Count() == 0)
			return;
		
		int remaining = cleaned;
		
		foreach (vector position : objectivePositions)
		{
			if (remaining <= 0)
				break;
			
			gameMode.MDST_RecordAIKillsNear(position, m_fStatsAIKillCreditRadius, 1);
			remaining--;
		}
	}
	
	//------------------------------------------------------------------------------------------------
	// UTILITY FUNCTIONS
	//------------------------------------------------------------------------------------------------
	
	protected void GetAllPlayerPositions(notnull array<vector> outPositions)
	{
		array<int> playerIds = {};
		GetGame().GetPlayerManager().GetPlayers(playerIds);
		
		foreach (int playerId : playerIds)
		{
			IEntity playerEntity = GetGame().GetPlayerManager().GetPlayerControlledEntity(playerId);
			if (playerEntity)
			{
				outPositions.Insert(playerEntity.GetOrigin());
			}
		}
	}
	
	//------------------------------------------------------------------------------------------------
	protected int GetPlayerCount()
	{
		array<int> playerIds = {};
		GetGame().GetPlayerManager().GetPlayers(playerIds);
		return playerIds.Count();
	}
	
	//------------------------------------------------------------------------------------------------
	// Called when a player dies - track for difficulty adjustment
	void OnPlayerDeath(int playerId)
	{
		m_iTotalPlayerDeaths++;
		m_DifficultyManager.OnPlayerDeath();
		
		// Notify objectives near the player for tracking
		IEntity playerEntity = GetGame().GetPlayerManager().GetPlayerControlledEntity(playerId);
		if (playerEntity && m_ObjectiveManager)
		{
			m_ObjectiveManager.OnPlayerDeathNear(playerEntity.GetOrigin());
		}
	}
	
	//------------------------------------------------------------------------------------------------
	// Static getter for the component
	static SHS_EndlessObjectivesGameModeComponent GetInstance()
	{
		BaseGameMode gameMode = GetGame().GetGameMode();
		if (!gameMode)
			return null;
		
		return SHS_EndlessObjectivesGameModeComponent.Cast(
			gameMode.FindComponent(SHS_EndlessObjectivesGameModeComponent));
	}
}
