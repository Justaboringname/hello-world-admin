import { vibeLabel } from "@/lib/captions";
import type { Dashboard } from "@/lib/dashboard";
import { formatDateTime, formatNumber } from "@/lib/format";
import { ActivityChart } from "./activity-chart";
import { AiVsHumans, compareKinds } from "./ai-vs-humans";
import { SERIES, SIGNUPS_TRACK } from "./colors";
import { Funnel } from "./funnel";
import { CaptionList, MemeList } from "./hall-of-fame";
import { HealthFacts } from "./health";
import { LocationBoard } from "./locations";
import { ModelBoard, modelHeadline, modelStats } from "./models";
import {
  DAY_NAMES,
  FEW_VOTES,
  dayLabel,
  formatWait,
  hourName,
  normalizeDashboard,
  percent,
  personName,
  plural,
  share,
  signed,
  truncate,
  weekChange,
} from "./numbers";
import { NoData, Panel, TableView } from "./panel";
import { AwardList, CreatorList, VoterList, settleAwards } from "./people";
import { PositionBias, positionHeadline, positionStats } from "./positions";
import { StatTile } from "./stat-tile";
import { VibeBoard, rankVibes } from "./vibes";
import { VoteHeatmap, summarizeHeatmap } from "./vote-heatmap";

// Every headline below is worked out from the numbers, so it says what the
// data shows today rather than what we hoped it would.

function activityHeadline(now: number, before: number, month: number) {
  if (!now && !before) {
    return month ? "A quiet fortnight: no votes in the last 14 days" : "No votes in the last 30 days";
  }
  if (!before) return `${plural(now, "vote")} this week, up from none the week before`;
  if (!now) return `No votes this week, after ${plural(before, "vote")} the week before`;
  // Within 5% either way is noise, not news.
  if (Math.abs(now - before) / before < 0.05) return "Voting is holding steady, week to week";
  const change = weekChange(now, before);
  return `Voting is ${change.tone === "good" ? "up" : "down"} ${change.text} on the week before`;
}

// A peak picked from a handful of votes is just whoever voted first.
function heatmapHeadline({ peak, total }: ReturnType<typeof summarizeHeatmap>) {
  if (!peak) return "No votes yet, so no rhythm to show";
  if (total < FEW_VOTES) return `Only ${plural(total, "vote")} so far: too few to show a rhythm`;
  return `Campus laughs hardest on ${DAY_NAMES[peak.dow]}s around ${hourName(peak.hour)}`;
}

function funnelHeadline(funnel: Dashboard["funnel"]) {
  if (!funnel.signed_up) return "No sign-ups yet";
  if (funnel.regulars > 0) {
    const oneIn = Math.round(funnel.signed_up / funnel.regulars);
    return oneIn <= 1
      ? "Nearly everyone who signs up becomes a regular"
      : `1 in ${oneIn} sign-ups becomes a regular`;
  }
  if (funnel.voted > 0) {
    return `${percent(share(funnel.voted, funnel.signed_up))} of sign-ups have voted, but no regulars yet`;
  }
  return "Nobody has voted yet";
}

function kindsHeadline({ ai, humans, winner }: ReturnType<typeof compareKinds>) {
  if (winner === null) {
    if (!ai.votes && !humans.votes) return "No votes on either side yet";
    if (!ai.votes || !humans.votes) {
      return ai.votes ? "Only AI captions have votes so far" : "Only memes have votes so far";
    }
    return `Too early to call: ${percent(ai.rate)} 👍 for AI, ${percent(humans.rate)} for memes, on few votes`;
  }
  if (winner === "tie") return `A dead heat: both get 👍 about ${percent(ai.rate)} of the time`;
  return winner === "humans"
    ? `Humans win: memes get 👍 ${percent(humans.rate)} of the time, AI captions ${percent(ai.rate)}`
    : `AI wins: Gemini's captions get 👍 ${percent(ai.rate)} of the time, memes ${percent(humans.rate)}`;
}

const andList = new Intl.ListFormat("en", { type: "conjunction" });

// The names sharing first place, or null when there's a clear leader. Up to
// three are named; beyond that the count says it ("4 spots").
function tiedLeaders<T>(
  rows: T[],
  value: (row: T) => number,
  name: (row: T) => string,
  noun: string,
) {
  const top = rows.filter((row) => value(row) === value(rows[0]!));
  if (top.length < 2) return null;
  return top.length <= 3 ? andList.format(top.map(name)) : `${top.length} ${noun}`;
}

function creatorHeadline(creators: Dashboard["top_creators"]) {
  const [top] = creators;
  if (!top) return "Nobody has posted yet";
  if (top.upvotes <= 0) return "No 👍 on anyone's posts yet";
  const tied = tiedLeaders(creators, (c) => c.upvotes, (c) => personName(c.name), "people");
  return tied
    ? `${tied} share the most 👍 (${formatNumber(top.upvotes)} each)`
    : `${personName(top.name)} has earned the most 👍 (${formatNumber(top.upvotes)})`;
}

function locationHeadline(locations: Dashboard["locations"]) {
  const [top] = locations;
  if (!top) return "No locations yet";
  const tied = tiedLeaders(locations, (l) => l.photos, (l) => l.location, "spots");
  return tied ? `📍 ${tied} tie for the top spot` : `📍 ${top.location} is the top spot`;
}

function awardsHeadline(awards: Dashboard["awards"]) {
  const { harshest_critic: critic, biggest_fan: fan, night_owl: owl } = awards;
  if (critic) {
    return `${personName(critic.name)} is the toughest crowd (${percent(share(critic.upvotes, critic.votes))} 👍)`;
  }
  if (fan) return `${personName(fan.name)} is the biggest fan (${percent(share(fan.upvotes, fan.votes))} 👍)`;
  if (owl) return `${personName(owl.name)} votes the latest`;
  return "No awards to hand out yet";
}

export function DashboardView({ dashboard }: { dashboard: Dashboard }) {
  const d = normalizeDashboard(dashboard);
  const { totals, funnel } = d;
  const now = d.last_7_days;
  const before = d.previous_7_days;
  const fortnight = d.daily.slice(-14);
  const posts = totals.photos + totals.user_memes;

  const monthVotes = d.daily.reduce((sum, day) => sum + day.votes, 0);
  const busiest = d.daily.reduce<Dashboard["daily"][number] | null>(
    (best, day) => (day.votes > 0 && (!best || day.votes > best.votes) ? day : best),
    null,
  );
  const heat = summarizeHeatmap(d.heatmap);
  const kinds = compareKinds(d.kinds);
  const vibes = rankVibes(d.vibes);
  const bestVibe = vibes.find((row) => row.rate !== null);
  const positions = positionStats(d.positions, d.decided_photos, totals.captions, totals.photos);
  const models = modelStats(d.models);
  const awards = settleAwards(d.awards);
  const topCaption = d.top_captions[0];
  const splitCaption = d.divisive_captions[0];
  const topMeme = d.top_memes[0];
  const topVoter = d.top_voters[0];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon="👥"
          label="Users"
          value={totals.users}
          current={now.users}
          previous={before.users}
          comparison={`${formatNumber(now.users)} joined in the last 7 days, ${formatNumber(before.users)} the week before`}
          trend={{
            days: fortnight.map((day) => ({ day: day.day, value: day.signups })),
            color: SERIES.signups,
            noun: "sign-ups",
          }}
          facts={`${formatNumber(totals.admins)} ${totals.admins === 1 ? "admin" : "admins"} · ${percent(share(funnel.named, funnel.signed_up))} added their name`}
        />
        <StatTile
          icon="🖼️"
          label="Posts"
          value={posts}
          current={now.posts}
          previous={before.posts}
          comparison={`${formatNumber(now.posts)} in the last 7 days, ${formatNumber(before.posts)} the week before`}
          trend={{
            days: fortnight.map((day) => ({ day: day.day, value: day.photos + day.memes })),
            color: SERIES.posts,
            noun: "posts",
          }}
          facts={`${formatNumber(totals.photos)} AI photos · ${formatNumber(totals.user_memes)} memes · ${formatNumber(totals.captions)} captions`}
        />
        <StatTile
          icon="🗳️"
          label="Votes"
          value={totals.votes}
          current={now.votes}
          previous={before.votes}
          comparison={`${formatNumber(now.votes)} in the last 7 days, ${formatNumber(before.votes)} the week before`}
          trend={{
            days: fortnight.map((day) => ({ day: day.day, value: day.votes })),
            color: SERIES.votes,
            noun: "votes",
          }}
          facts={`${percent(share(totals.upvotes, totals.votes))} 👍 · ${formatNumber(totals.voters)} ${totals.voters === 1 ? "voter" : "voters"}`}
        />
        <StatTile
          icon="🔥"
          label="Active this week"
          value={now.active_users}
          current={now.active_users}
          previous={before.active_users}
          comparison={`voted or posted, against ${formatNumber(before.active_users)} the week before`}
          meter={{
            value: now.active_users,
            max: totals.users,
            fill: SERIES.signups,
            track: SIGNUPS_TRACK,
            label: `${percent(share(now.active_users, totals.users))} of all ${formatNumber(totals.users)} users`,
          }}
          facts={`${formatNumber(funnel.regulars)} ${funnel.regulars === 1 ? "regular" : "regulars"} (voted on 3+ days)`}
        />
      </div>

      {/* Dense flow lets a narrow card fill the gap beside a wide one, so
          two-column screens don't end up with holes. */}
      <div className="grid grid-flow-row-dense gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel
          id="activity"
          topic="Last 30 days"
          title={activityHeadline(now.votes, before.votes, monthVotes)}
          description={
            busiest
              ? `Busiest day: ${dayLabel(busiest.day, "long")}, with ${plural(busiest.votes, "vote")}. Days are New York time.`
              : "Days are New York time."
          }
          className="md:col-span-2"
        >
          <ActivityChart days={d.daily} />
          <TableView
            caption="Votes, posts and sign-ups per day, newest first"
            columns={["Day", "Votes", "Photos", "Memes", "Sign-ups"]}
            rows={[...d.daily]
              .reverse()
              .map((day) => [dayLabel(day.day, "long"), day.votes, day.photos, day.memes, day.signups])}
          />
        </Panel>

        <Panel
          id="funnel"
          topic="From sign-up to regular"
          title={funnelHeadline(funnel)}
          description="People at each step, as a share of everyone who signed up."
          footer="Steps count people and aren't nested: someone can post without ever voting."
        >
          <Funnel funnel={funnel} />
        </Panel>

        <Panel
          id="heatmap"
          topic="When does campus laugh?"
          title={heatmapHeadline(heat)}
          description="Votes by weekday and hour, New York time. The busier the hour, the more its square stands out."
          className="md:col-span-2"
        >
          <VoteHeatmap summary={heat} />
        </Panel>

        <Panel id="kinds" topic="AI vs. humans: who's funnier?" title={kindsHeadline(kinds)}>
          <AiVsHumans
            comparison={kinds}
            captions={totals.captions}
            classics={Math.max(0, totals.memes - totals.user_memes)}
          />
        </Panel>

        <Panel
          id="vibes"
          topic="Vibes leaderboard"
          title={
            !bestVibe
              ? "No votes on any vibe yet"
              : bestVibe.votes < FEW_VOTES
                ? `${vibeLabel(bestVibe.vibe)} leads, on just ${formatNumber(bestVibe.votes)} ${bestVibe.votes === 1 ? "vote" : "votes"}`
                : `${vibeLabel(bestVibe.vibe)} gets the most laughs`
          }
          description={`Each voice's captions, ranked by the share of votes that are 👍. Vibes with under ${FEW_VOTES} votes rank after the rest.`}
        >
          <VibeBoard rows={vibes} />
        </Panel>

        <Panel
          id="positions"
          topic="Does Gemini save its best joke for first?"
          title={positionHeadline(positions)}
          description={
            positions.decided
              ? `Which caption leads each of the ${formatNumber(positions.decided)} photos with a clear winner.`
              : undefined
          }
        >
          {positions.decided && positions.rows.length ? (
            <PositionBias stats={positions} />
          ) : (
            <NoData>A photo counts once one of its captions is ahead outright. None is yet.</NoData>
          )}
        </Panel>

        <Panel
          id="models"
          topic="Gemini models"
          title={modelHeadline(models)}
          description="Photos per model, and how their captions scored."
        >
          {models.rows.length ? <ModelBoard stats={models} /> : <NoData>No photos yet.</NoData>}
        </Panel>

        <Panel
          id="top-captions"
          topic="Hall of fame: captions"
          title={topCaption ? `Gemini's best line scored ${signed(topCaption.score)}` : "No caption votes yet"}
          description="The highest scores (👍 minus 👎). Open one to see its photo."
        >
          {d.top_captions.length ? (
            <CaptionList captions={d.top_captions} variant="top" />
          ) : (
            <NoData>Once people vote on captions, the best ones show up here.</NoData>
          )}
        </Panel>

        <Panel
          id="divisive"
          topic="Most divisive"
          title={
            splitCaption
              ? `The most divisive caption split ${formatNumber(splitCaption.upvotes)} 👍 to ${formatNumber(splitCaption.downvotes)} 👎`
              : "Nobody disagrees yet"
          }
          description="Captions with the most votes on both sides."
        >
          {d.divisive_captions.length ? (
            <CaptionList captions={d.divisive_captions} variant="divisive" />
          ) : (
            <NoData>No caption has both a 👍 and a 👎 yet.</NoData>
          )}
        </Panel>

        <Panel
          id="top-memes"
          topic="Hall of fame: memes"
          title={topMeme ? `“${truncate(topMeme.title, 40)}” is the crowd favorite` : "No meme votes yet"}
          description="The highest-scoring memes, people's and the classics alike."
        >
          {d.top_memes.length ? <MemeList memes={d.top_memes} /> : <NoData>No meme has a vote yet.</NoData>}
        </Panel>

        <Panel
          id="creators"
          topic="Top creators"
          title={creatorHeadline(d.top_creators)}
          description="👍 on their photos' captions and on their memes."
        >
          {d.top_creators.length ? (
            <CreatorList creators={d.top_creators} />
          ) : (
            <NoData>No posts yet.</NoData>
          )}
        </Panel>

        <Panel
          id="voters"
          topic="Top voters"
          title={
            topVoter
              ? `${personName(topVoter.name)} has voted the most (${plural(topVoter.votes, "time")})`
              : "Nobody has voted yet"
          }
          description="Votes cast, how many were 👍, and on how many days."
        >
          {d.top_voters.length ? <VoterList voters={d.top_voters} /> : <NoData>No votes yet.</NoData>}
        </Panel>

        <Panel
          id="awards"
          topic="Superlatives"
          title={awardsHeadline(awards)}
          description="Critic and fan need 5+ votes. Late night is midnight to 5 AM, New York time."
        >
          <AwardList awards={awards} />
        </Panel>

        <Panel
          id="locations"
          topic="Where people post from"
          title={locationHeadline(d.locations)}
          description="The 8 most common, as people typed them, with their share of all photos."
        >
          {d.locations.length ? (
            <LocationBoard locations={d.locations} photos={totals.photos} />
          ) : (
            <NoData>Nobody has added a location to a photo yet.</NoData>
          )}
        </Panel>

        <Panel
          id="health"
          topic="Health check"
          title={
            d.first_vote_minutes !== null
              ? `New posts get their first vote in ${formatWait(d.first_vote_minutes)} (median)`
              : "No post has a vote yet"
          }
          description="Whether new posts get seen, and who's taking part."
          className="md:col-span-2"
        >
          <HealthFacts totals={totals} firstVoteMinutes={d.first_vote_minutes} />
        </Panel>
      </div>

      <footer className="pt-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
        Stats generated {formatDateTime(d.generated_at)}, New York time. Days and hours on this page
        are New York time too.
      </footer>
    </div>
  );
}
