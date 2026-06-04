//------------------------------------------------------------------------------------------------
//! Best-effort weapon/source metadata helpers for combat telemetry.
//------------------------------------------------------------------------------------------------

class MDST_WeaponMetadata
{
	//------------------------------------------------------------------------------------------------
	static string GetWeaponIdFromSource(IEntity sourceEntity)
	{
		if (!sourceEntity)
			return "";

		if (IsPlayerControlledEntity(sourceEntity))
			return "";

		EntityPrefabData prefabData = sourceEntity.GetPrefabData();
		if (prefabData)
			return prefabData.GetPrefabName();

		return sourceEntity.ToString();
	}

	//------------------------------------------------------------------------------------------------
	static string GetWeaponNameFromSource(IEntity sourceEntity)
	{
		return GetWeaponIdFromSource(sourceEntity);
	}

	//------------------------------------------------------------------------------------------------
	static bool IsPlayerControlledEntity(IEntity entity)
	{
		if (!entity)
			return false;

		PlayerManager playerManager = GetGame().GetPlayerManager();
		if (!playerManager)
			return false;

		return playerManager.GetPlayerIdFromControlledEntity(entity) > 0;
	}
}
