package blog.domain;

import blog.domain.Post.PostKind;
import blog.domain.Post.PostSlug;

/**
 * Returns the lead story used by the journal index.
 *
 * The catalogue is module-scoped immutable application data, so it uses module
 * functions rather than a class that could never be instantiated. The same
 * typed `Post` values drive prerendered paths, metadata, links, and Server
 * Component rendering; Next.js still performs the actual static generation.
 */
function featured():Post {
	return afterTheBurn();
}

/** Returns the secondary stories in their editorial display order. */
function fieldNotes():Array<Post> {
	return [trailPromise(), snowline()];
}

/** Returns every story used to derive `generateStaticParams`. */
function all():Array<Post> {
	return [afterTheBurn(), trailPromise(), snowline()];
}

/** Resolves an untrusted route slug without pretending every string is known. */
function find(slug:PostSlug):Null<Post> {
	for (post in all()) {
		if (post.slug == slug) {
			return post;
		}
	}
	return null;
}

/** Chooses the next story and wraps the final story back to the beginning. */
function nextAfter(slug:PostSlug):Post {
	if (slug == "after-the-burn") {
		return trailPromise();
	}
	if (slug == "a-trail-is-a-promise") {
		return snowline();
	}
	return afterTheBurn();
}

/** Constructs the lead field note as one closed immutable `Post` value. */
function afterTheBurn():Post {
	return {
		slug: "after-the-burn",
		kind: PostKind.FieldNote,
		issue: "No. 18",
		title: "What returns after the burn",
		dek: "Walking the first green line through a high-desert watershed, one season after fire.",
		excerpt: "The landscape does not reset. It answers—first with ash, then lupine, then the patient geometry of water finding its way home.",
		published: "June 14, 2026",
		minutes: 8,
		location: "Wallowa–Whitman",
		coordinates: "45° 13′ N / 117° 41′ W",
		elevation: "1,684 m",
		paragraphs: [
			"At the trailhead, the burn reads as absence: black poles against a sky too large for them, dust lifting from every footfall. A mile in, scale changes. Pinpricks of yarrow hold the slope. Lupine gathers in the cooler folds where snow stayed late.",
			"Fire simplified the canopy but complicated the ground. Water now crosses the path in new places, carrying charcoal into shallow fans. The crew marks each crossing with a small cairn, less as a direction for hikers than as a note to the next storm.",
			"Recovery is not a return to the photograph we remember. It is a negotiation among heat, seed, water, and time. The best work here is modest: slow the runoff, keep boots out of the softest soil, and notice what has already begun without us."
		]
	};
}

/** Constructs the stewardship dispatch as one closed immutable `Post` value. */
function trailPromise():Post {
	return {
		slug: "a-trail-is-a-promise",
		kind: PostKind.Stewardship,
		issue: "No. 17",
		title: "A trail is a promise",
		dek: "Why the most durable paths begin with restraint, not machinery.",
		excerpt: "Every switchback is an agreement between a body, a slope, and the water that will arrive long after the crew has gone.",
		published: "May 28, 2026",
		minutes: 6,
		location: "North Cascades",
		coordinates: "48° 44′ N / 121° 04′ W",
		elevation: "1,220 m",
		paragraphs: [
			"The quickest line uphill is almost always the shortest-lived. A good trail refuses that impatience. It turns across the contour, borrows strength from roots and stone, and lets water leave before water learns to follow.",
			"On maintenance days we spend more time listening than cutting. A damp patch names a buried spring. Gravel below a corner records the speed of last winter's runoff. The path tells us where our first idea was wrong.",
			"Stewardship is the practice of leaving a route legible without making the mountain feel engineered. The promise is simple: passage today should not cost the hillside its future."
		]
	};
}

/** Constructs the trail-craft dispatch as one closed immutable `Post` value. */
function snowline():Post {
	return {
		slug: "reading-the-snowline",
		kind: PostKind.TrailCraft,
		issue: "No. 16",
		title: "Reading the last snowline",
		dek: "A spring notebook for deciding when an alpine route is ready to carry us.",
		excerpt: "The calendar offers a date. The mountain offers evidence: bent heather, hollow drifts, and water moving beneath white crust.",
		published: "April 19, 2026",
		minutes: 7,
		location: "Three Sisters",
		coordinates: "44° 06′ N / 121° 46′ W",
		elevation: "2,030 m",
		paragraphs: [
			"From the valley, the south face looks open. Up close, every shaded roll holds winter. Boots punch through at the edge of boulders where dark stone has warmed a hidden moat.",
			"The question is not whether a determined person can cross. It is what a hundred crossings will do to soil that has only just thawed. A single widening track can become the season's preferred drainage.",
			"We turn around below the saddle. Restraint leaves no dramatic summit photograph, only an intact meadow and a reason to return when the last snowline has moved of its own accord."
		]
	};
}
