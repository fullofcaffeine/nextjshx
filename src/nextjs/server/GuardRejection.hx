package nextjs.server;

import nextjs.codec.DecodeIssue;

/** Coarse pre-mutation failure that an application maps to a public result. */
enum GuardRejection {
	Malformed(issues:Array<DecodeIssue>);
	Unauthenticated;
	Unavailable;
}
