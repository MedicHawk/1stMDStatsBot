//------------------------------------------------------------------------------------------------
//! Optional ACE Anvil adapter.
//! Requires ACE Medical Core / ACE Carrying / ACE Captives to be loaded before this addon.
//------------------------------------------------------------------------------------------------

class MDST_ACEEventBridge
{
	static int GetPlayerIdFromEntity(IEntity entity)
	{
		if (!entity)
			return 0;

		PlayerManager playerManager = GetGame().GetPlayerManager();
		if (!playerManager)
			return 0;

		return playerManager.GetPlayerIdFromControlledEntity(entity);
	}

	static void RecordMedical(IEntity patientEntity, IEntity medicEntity, string eventType, float amount = 0)
	{
		int medicPlayerId = GetPlayerIdFromEntity(medicEntity);
		if (medicPlayerId <= 0)
			return;

		int patientPlayerId = GetPlayerIdFromEntity(patientEntity);
		SCR_BaseGameMode gameMode = SCR_BaseGameMode.Cast(GetGame().GetGameMode());
		if (!gameMode)
			return;

		if (patientPlayerId > 0)
			gameMode.MDST_RecordMedicalEventWithTarget(medicPlayerId, eventType, patientPlayerId, 0, amount);
		else
			gameMode.MDST_RecordMedicalEvent(medicPlayerId, eventType, 0, amount);
	}

	static void RecordSupport(IEntity targetEntity, IEntity helperEntity, string eventType, float amount = 0)
	{
		int helperPlayerId = GetPlayerIdFromEntity(helperEntity);
		if (helperPlayerId <= 0)
			return;

		int targetPlayerId = GetPlayerIdFromEntity(targetEntity);
		SCR_BaseGameMode gameMode = SCR_BaseGameMode.Cast(GetGame().GetGameMode());
		if (!gameMode)
			return;

		if (targetPlayerId > 0)
			gameMode.MDST_RecordSupportEventWithTarget(helperPlayerId, eventType, targetPlayerId, amount);
		else
			gameMode.MDST_RecordSupportEvent(helperPlayerId, eventType);
	}
}

modded class ACE_Medical_EpinephrineUserAction
{
	override void PerformAction(IEntity pOwnerEntity, IEntity pUserEntity)
	{
		super.PerformAction(pOwnerEntity, pUserEntity);
		MDST_ACEEventBridge.RecordMedical(pOwnerEntity, pUserEntity, "revive");
	}
}

modded class ACE_Carrying_CarryUserAction
{
	override void PerformAction(IEntity pOwnerEntity, IEntity pUserEntity)
	{
		super.PerformAction(pOwnerEntity, pUserEntity);
		MDST_ACEEventBridge.RecordSupport(pOwnerEntity, pUserEntity, "squad_support");
	}
}

modded class ACE_Carrying_DragUserAction
{
	override void PerformAction(IEntity pOwnerEntity, IEntity pUserEntity)
	{
		super.PerformAction(pOwnerEntity, pUserEntity);
		MDST_ACEEventBridge.RecordSupport(pOwnerEntity, pUserEntity, "teamwork");
	}
}

modded class ACE_Captives_EscortCaptiveUserAction
{
	override void PerformAction(IEntity pOwnerEntity, IEntity pUserEntity)
	{
		super.PerformAction(pOwnerEntity, pUserEntity);
		MDST_ACEEventBridge.RecordSupport(pOwnerEntity, pUserEntity, "teamwork");
	}
}
