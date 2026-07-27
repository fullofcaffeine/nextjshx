package nextjs.raw.navigation;

import genes.ts.Undefinable;
import haxe.DynamicAccess;
import haxe.extern.EitherType;

/** One value in the dynamic route-parameter record returned by Next. */
@:ts.type("string | string[] | undefined")
typedef RouteParamValue = Undefinable<EitherType<String, Array<String>>>;

/** Default, string-keyed result of `useParams()`. */
@:ts.type("ReturnType<typeof import('next/navigation').useParams>")
typedef RouteParams = DynamicAccess<RouteParamValue>;
