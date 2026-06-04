//------------------------------------------------------------------------------------------------
//! Attach this component to AI character prefabs to report AI deaths to 1stMD Stats.
//! It polls the AI damage state and credits either the last recorded attacker or the nearest player.
//------------------------------------------------------------------------------------------------

[ComponentEditorProps(category: "1stMD/Stats", description: "Reports this AI character death as a player AI kill.")]
class MDST_AIKillReporterComponentClass : ScriptComponentClass
{
}

class MDST_AIKillReporterComponent : ScriptComponent
{
	[Attribute(defvalue: "1", UIWidgets.CheckBox, desc: "Enable AI kill reporting for this AI entity.", category: "1stMD Stats")]
	protected bool m_bEnabled;

	[Attribute(defvalue: "250", UIWidgets.Slider, desc: "Nearest-player fallback radius in meters.", params: "25 1000 25", category: "1stMD Stats")]
	protected float m_fFallbackRadiusMeters;

	[Attribute(defvalue: "1", UIWidgets.Slider, desc: "Death polling interval in seconds.", params: "0.25 5 0.25", category: "1stMD Stats")]
	protected float m_fPollSeconds;

	[Attribute(defvalue: "15", UIWidgets.Slider, desc: "Seconds before stored attacker data expires.", params: "1 60 1", category: "1stMD Stats")]
	protected float m_fAttackerMemorySeconds;

	protected IEntity m_Owner;
	protected bool m_bReported;
	protected int m_iLastAttackerPlayerId;
	protected IEntity m_LastAttackerEntity;
	protected string m_sLastWeaponId;
	protected string m_sLastWeaponName;
	protected float m_fLastAttackerTime;

	//------------------------------------------------------------------------------------------------
	override void OnPostInit(IEntity owner)
	{
		super.OnPostInit(owner);

		m_Owner = owner;

		if (!m_bEnabled)
			return;

		if (!GetGame() || !GetGame().InPlayMode())
			return;

		int pollMs = Math.Round(m_fPollSeconds * 1000);
		if (pollMs < 250)
			pollMs = 250;

		GetGame().GetCallqueue().CallLater(MDST_PollDeathState, pollMs, true);
	}

	//------------------------------------------------------------------------------------------------
	void MDST_RecordDamageFromPlayer(int playerId, string weaponId = "", string weaponName = "")
	{
		if (playerId <= 0)
			return;

		m_iLastAttackerPlayerId = playerId;
		m_LastAttackerEntity = null;
		m_sLastWeaponId = weaponId;
		m_sLastWeaponName = weaponName;
		m_fLastAttackerTime = MDST_GetWorldTimeSeconds();
	}

	//------------------------------------------------------------------------------------------------
	void MDST_RecordDamageFromEntity(IEntity attackerEntity, string weaponId = "", string weaponName = "")
	{
		if (!attackerEntity)
			return;

		m_iLastAttackerPlayerId = 0;
		m_LastAttackerEntity = attackerEntity;
		m_sLastWeaponId = weaponId;
		m_sLastWeaponName = weaponName;
		m_fLastAttackerTime = MDST_GetWorldTimeSeconds();
	}

	//------------------------------------------------------------------------------------------------
	void MDST_RecordDamageFromInstigator(notnull Instigator instigator, IEntity attackerEntity = null, string weaponId = "", string weaponName = "")
	{
		int playerId = instigator.GetInstigatorPlayerID();
		if (playerId > 0)
		{
			MDST_RecordDamageFromPlayer(playerId, weaponId, weaponName);
			return;
		}

		MDST_RecordDamageFromEntity(attackerEntity, weaponId, weaponName);
	}

	//------------------------------------------------------------------------------------------------
	void MDST_ReportDeathNow()
	{
		if (m_bReported || !m_Owner)
			return;

		m_bReported = true;
		GetGame().GetCallqueue().Remove(MDST_PollDeathState);

		SCR_BaseGameMode gameMode = SCR_BaseGameMode.Cast(GetGame().GetGameMode());
		if (!gameMode)
			return;

		float now = MDST_GetWorldTimeSeconds();
		bool hasFreshAttacker = m_fLastAttackerTime > 0 && now - m_fLastAttackerTime <= m_fAttackerMemorySeconds;

		if (hasFreshAttacker && m_iLastAttackerPlayerId > 0)
		{
			gameMode.MDST_RecordAIKilledByPlayer(m_iLastAttackerPlayerId, m_Owner, m_sLastWeaponId, m_sLastWeaponName);
			return;
		}

		if (hasFreshAttacker && m_LastAttackerEntity)
		{
			gameMode.MDST_RecordAIKilledByEntity(m_Owner, m_LastAttackerEntity, m_sLastWeaponId, m_sLastWeaponName);
			return;
		}

		gameMode.MDST_RecordAIKillNear(m_Owner.GetOrigin(), m_fFallbackRadiusMeters, m_sLastWeaponId, m_sLastWeaponName);
	}

	//------------------------------------------------------------------------------------------------
	protected void MDST_PollDeathState()
	{
		if (m_bReported || !m_Owner)
			return;

		DamageManagerComponent damageManager = DamageManagerComponent.Cast(m_Owner.FindComponent(DamageManagerComponent));
		if (!damageManager)
			return;

		if (damageManager.GetState() == EDamageState.DESTROYED)
			MDST_ReportDeathNow();
	}

	//------------------------------------------------------------------------------------------------
	protected float MDST_GetWorldTimeSeconds()
	{
		if (!GetGame() || !GetGame().GetWorld())
			return 0;

		return GetGame().GetWorld().GetWorldTime() * 0.001;
	}
}
