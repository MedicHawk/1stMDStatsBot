//------------------------------------------------------------------------------------------------
//! Best-effort weapon/source metadata helpers for combat telemetry.
//------------------------------------------------------------------------------------------------

class MDST_WeaponMetadata
{
	//------------------------------------------------------------------------------------------------
	static string GetWeaponIdForPlayer(int playerId, IEntity sourceEntity = null)
	{
		BaseWeaponComponent weapon = GetHeldWeaponForPlayer(playerId);
		string weaponId = GetWeaponIdFromWeapon(weapon);
		if (!weaponId.IsEmpty())
			return weaponId;

		return GetWeaponIdFromSource(sourceEntity);
	}

	//------------------------------------------------------------------------------------------------
	static string GetWeaponNameForPlayer(int playerId, IEntity sourceEntity = null)
	{
		BaseWeaponComponent weapon = GetHeldWeaponForPlayer(playerId);
		string weaponName = GetWeaponNameFromWeapon(weapon);
		if (!weaponName.IsEmpty())
			return weaponName;

		return GetWeaponNameFromSource(sourceEntity);
	}

	//------------------------------------------------------------------------------------------------
	static string GetWeaponIdFromSource(IEntity sourceEntity)
	{
		if (!sourceEntity)
			return "";

		if (IsPlayerControlledEntity(sourceEntity))
		{
			int playerId = GetPlayerIdFromEntity(sourceEntity);
			return GetWeaponIdForPlayer(playerId);
		}

		EntityPrefabData prefabData = sourceEntity.GetPrefabData();
		if (prefabData)
			return prefabData.GetPrefabName();

		return sourceEntity.ToString();
	}

	//------------------------------------------------------------------------------------------------
	static string GetWeaponNameFromSource(IEntity sourceEntity)
	{
		if (!sourceEntity)
			return "";

		if (IsPlayerControlledEntity(sourceEntity))
		{
			int playerId = GetPlayerIdFromEntity(sourceEntity);
			return GetWeaponNameForPlayer(playerId);
		}

		return GetWeaponIdFromSource(sourceEntity);
	}

	//------------------------------------------------------------------------------------------------
	protected static BaseWeaponComponent GetHeldWeaponForPlayer(int playerId)
	{
		if (playerId <= 0)
			return null;

		PlayerManager playerManager = GetGame().GetPlayerManager();
		if (!playerManager)
			return null;

		IEntity playerEntity = playerManager.GetPlayerControlledEntity(playerId);
		if (!playerEntity)
			return null;

		CharacterWeaponManagerComponent weaponManager = CharacterWeaponManagerComponent.Cast(playerEntity.FindComponent(CharacterWeaponManagerComponent));
		if (!weaponManager)
			return null;

		return weaponManager.GetCurrentWeapon();
	}

	//------------------------------------------------------------------------------------------------
	protected static string GetWeaponIdFromWeapon(BaseWeaponComponent weapon)
	{
		if (!weapon)
			return "";

		IEntity weaponEntity = weapon.GetOwner();
		if (weaponEntity)
		{
			EntityPrefabData prefabData = weaponEntity.GetPrefabData();
			if (prefabData)
				return prefabData.GetPrefabName();
		}

		return GetWeaponNameFromWeapon(weapon);
	}

	//------------------------------------------------------------------------------------------------
	protected static string GetWeaponNameFromWeapon(BaseWeaponComponent weapon)
	{
		if (!weapon)
			return "";

		UIInfo uiInfo = weapon.GetUIInfo();
		if (uiInfo)
			return uiInfo.GetName();

		IEntity weaponEntity = weapon.GetOwner();
		if (weaponEntity)
			return weaponEntity.ToString();

		return "";
	}

	//------------------------------------------------------------------------------------------------
	static bool IsPlayerControlledEntity(IEntity entity)
	{
		return GetPlayerIdFromEntity(entity) > 0;
	}

	//------------------------------------------------------------------------------------------------
	static int GetPlayerIdFromEntity(IEntity entity)
	{
		if (!entity)
			return 0;

		PlayerManager playerManager = GetGame().GetPlayerManager();
		if (!playerManager)
			return 0;

		return playerManager.GetPlayerIdFromControlledEntity(entity);
	}
}
