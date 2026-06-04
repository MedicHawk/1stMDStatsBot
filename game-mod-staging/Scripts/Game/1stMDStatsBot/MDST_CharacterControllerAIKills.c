//------------------------------------------------------------------------------------------------
//! AI kill hook using the same character life-state signal as the 1stMD Scoreboard addon.
//------------------------------------------------------------------------------------------------

modded class SCR_CharacterControllerComponent
{
	override void OnLifeStateChanged(ECharacterLifeState previousLifeState, ECharacterLifeState newLifeState, bool isJIP)
	{
		super.OnLifeStateChanged(previousLifeState, newLifeState, isJIP);

		if (isJIP || !Replication.IsServer())
			return;

		if (previousLifeState == ECharacterLifeState.DEAD || newLifeState != ECharacterLifeState.DEAD)
			return;

		IEntity victimEntity = GetOwner();
		if (!victimEntity)
			return;

		PlayerManager playerManager = GetGame().GetPlayerManager();
		if (!playerManager)
			return;

		if (playerManager.GetPlayerIdFromControlledEntity(victimEntity) > 0)
			return;

		ChimeraCharacter character = ChimeraCharacter.Cast(victimEntity);
		if (!character)
			return;

		SCR_DamageManagerComponent damageManager = character.GetDamageManager();
		if (!damageManager)
			return;

		Instigator instigator = damageManager.GetInstigator();
		int killerPlayerId = instigator.GetInstigatorPlayerID();
		if (killerPlayerId <= 0)
			return;

		SCR_BaseGameMode gameMode = SCR_BaseGameMode.Cast(GetGame().GetGameMode());
		if (!gameMode)
			return;

		Print(string.Format("[1stMD Stats] AI life-state kill detected player_id=%1", killerPlayerId), LogLevel.NORMAL);
		gameMode.MDST_RecordAIKilledByInstigator(victimEntity, null, instigator);
	}
}
