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

		weaponId = GetVehicleIdForPlayer(playerId);
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

		weaponName = GetVehicleNameForPlayer(playerId);
		if (!weaponName.IsEmpty())
			return weaponName;

		return GetWeaponNameFromSource(sourceEntity);
	}

	//------------------------------------------------------------------------------------------------
	static string GetVehicleIdForPlayer(int playerId)
	{
		IEntity vehicle = GetVehicleForPlayer(playerId);
		return GetEntityPrefabName(vehicle);
	}

	//------------------------------------------------------------------------------------------------
	static string GetVehicleNameForPlayer(int playerId)
	{
		return GetVehicleIdForPlayer(playerId);
	}

	//------------------------------------------------------------------------------------------------
	static bool IsPlayerInVehicle(int playerId)
	{
		return GetVehicleForPlayer(playerId) != null;
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

		string prefabName = GetEntityPrefabName(sourceEntity);
		if (!prefabName.IsEmpty())
			return prefabName;

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
	protected static IEntity GetVehicleForPlayer(int playerId)
	{
		if (playerId <= 0)
			return null;

		PlayerManager playerManager = GetGame().GetPlayerManager();
		if (!playerManager)
			return null;

		IEntity playerEntity = playerManager.GetPlayerControlledEntity(playerId);
		if (!playerEntity)
			return null;

		return CompartmentAccessComponent.GetVehicleIn(playerEntity);
	}

	//------------------------------------------------------------------------------------------------
	protected static string GetWeaponIdFromWeapon(BaseWeaponComponent weapon)
	{
		if (!weapon)
			return "";

		IEntity weaponEntity = weapon.GetOwner();
		string prefabName = GetEntityPrefabName(weaponEntity);
		if (!prefabName.IsEmpty())
			return prefabName;

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
	protected static string GetEntityPrefabName(IEntity entity)
	{
		if (!entity)
			return "";

		EntityPrefabData prefabData = entity.GetPrefabData();
		if (prefabData)
			return prefabData.GetPrefabName();

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
