package client_components.client;

import nextjs.raw.integrations.nuqs.Nuqs;
import nextjs.raw.integrations.nuqs.QueryStateResult.DefaultQueryStateResult;
import nextjs.raw.integrations.nuqs.QueryStateResult.NullableQueryStateResult;

/** Positive evidence that the faithful raw nuqs tuple remains precisely typed. */
@:keep
class RawNuqsContracts {
	@:next.hook
	public static function useNullableInteger():NullableQueryStateResult<Int> {
		return Nuqs.useQueryState("rawPage", Nuqs.parseAsInteger);
	}

	@:next.hook
	public static function useDefaultBoolean():DefaultQueryStateResult<Bool> {
		return Nuqs.useQueryState("rawArchived", Nuqs.parseAsBoolean.withDefault(false));
	}
}
