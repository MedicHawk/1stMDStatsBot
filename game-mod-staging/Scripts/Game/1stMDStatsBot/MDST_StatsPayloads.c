//------------------------------------------------------------------------------------------------
//! Shared payload helpers for the 1stMD stats API.
//! Keep payload keys aligned with docs/api.md in the Node backend project.
//------------------------------------------------------------------------------------------------

class MDST_Json
{
	static string Escape(string value)
	{
		if (value.IsEmpty())
			return "";

		value.Replace("\\", "\\\\");
		value.Replace("\"", "\\\"");
		value.Replace("\n", "\\n");
		value.Replace("\r", "\\r");
		return value;
	}

	static string Quote(string value)
	{
		return "\"" + Escape(value) + "\"";
	}

	static string PairString(string key, string value)
	{
		return Quote(key) + ":" + Quote(value);
	}

	static string PairInt(string key, int value)
	{
		return Quote(key) + ":" + value.ToString();
	}

	static string PairFloat(string key, float value)
	{
		return Quote(key) + ":" + value.ToString();
	}

	static string PairBool(string key, bool value)
	{
		if (value)
			return Quote(key) + ":true";

		return Quote(key) + ":false";
	}
}

class MDST_PlayerIdentity
{
	int m_iPlayerId;
	string m_sStableId;
	string m_sDisplayName;
	string m_sRankName;

	void MDST_PlayerIdentity(int playerId, string stableId, string displayName, string rankName = "")
	{
		m_iPlayerId = playerId;
		m_sStableId = stableId;
		m_sDisplayName = displayName;
		m_sRankName = rankName;
	}

	bool IsValid()
	{
		return !m_sStableId.IsEmpty();
	}
}

class MDST_ModInfo
{
	string m_sModId;
	string m_sName;
	string m_sVersion;
	bool m_bRequired;

	void MDST_ModInfo(string modId, string name, string version, bool required)
	{
		m_sModId = modId;
		m_sName = name;
		m_sVersion = version;
		m_bRequired = required;
	}

	string ToJson()
	{
		return "{" +
			MDST_Json.PairString("mod_id", m_sModId) + "," +
			MDST_Json.PairString("name", m_sName) + "," +
			MDST_Json.PairString("version", m_sVersion) + "," +
			MDST_Json.PairBool("required", m_bRequired) +
		"}";
	}
}
