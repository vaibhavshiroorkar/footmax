import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../state/auth";
import {
  BoardMetric,
  BoardMode,
  BoardRow,
  METRICS,
  fetchBoard,
  fetchMyRows,
} from "../state/social";
import { Card, Icon, Row, Screen, T, Tabs, haptic } from "../ui/kit";
import { Avatar } from "../ui/avatar";
import { alpha, colors, fonts } from "../ui/theme";

const DEFAULT_LOOK = { skin: 2, hair: 1, hairColor: 0, boots: 0 };

function value(r: BoardRow, metric: BoardMetric): string {
  const v = r[metric];
  return v === null || v === undefined ? "-" : String(v);
}

function BoardLine({
  r,
  rank,
  metric,
  mine,
}: {
  r: BoardRow;
  rank: number | null;
  metric: BoardMetric;
  mine: boolean;
}) {
  const router = useRouter();
  const username = r.profiles?.username;
  return (
    <Pressable
      onPress={() => {
        if (!username) return;
        haptic();
        router.push(`/u/${username}`);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${rank ? `Rank ${rank}, ` : ""}${r.name}, ${value(r, metric)}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 10,
        minHeight: 56,
        borderRadius: 12,
        backgroundColor: pressed
          ? colors.cardAlt
          : mine
            ? alpha(colors.accent, 0.08)
            : "transparent",
      })}
    >
      <Text
        style={{
          width: 30,
          fontFamily: fonts.display,
          fontSize: 18,
          color: rank && rank <= 3 ? colors.gold : colors.muted,
          textAlign: "center",
        }}
      >
        {rank ?? "-"}
      </Text>
      <Avatar
        look={r.look ?? DEFAULT_LOOK}
        kit={["#5b8cff", "#ffffff"]}
        size={36}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.text }}
          numberOfLines={1}
        >
          {r.name}
          {r.retired ? (
            <Text style={{ color: colors.muted }}> (retired)</Text>
          ) : null}
        </Text>
        <Text
          style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }}
          numberOfLines={1}
        >
          @{username ?? "unknown"}
          {r.club ? `  |  ${r.club}` : ""}
        </Text>
      </View>
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: 22,
          color: mine ? colors.accent : colors.text,
          minWidth: 36,
          textAlign: "right",
        }}
      >
        {value(r, metric)}
      </Text>
    </Pressable>
  );
}

export default function Leaderboards() {
  const router = useRouter();
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.session?.user.id ?? null);
  const [mode, setMode] = useState<BoardMode>("career");
  const [metric, setMetric] = useState<BoardMetric>("peak_ovr");
  // Results are tagged with the board they belong to, so switching boards
  // shows a spinner instead of the previous board's numbers.
  const key = `${mode}/${metric}`;
  const [result, setResult] = useState<{
    key: string;
    rows: BoardRow[];
    error: string | null;
  } | null>(null);
  const [mine, setMine] = useState<BoardRow[]>([]);
  const rows = result?.key === key ? result.rows : null;
  const error = result?.key === key ? result.error : null;

  useEffect(() => {
    let live = true;
    fetchBoard(mode, metric).then(
      (r) => live && setResult({ key: `${mode}/${metric}`, ...r }),
    );
    if (user) fetchMyRows(user, mode).then((r) => live && setMine(r));
    return () => {
      live = false;
    };
  }, [mode, metric, user]);

  const topIds = new Set((rows ?? []).map((r) => `${r.user_id}/${r.slot_id}`));
  const myBest = [...mine].sort(
    (a, b) => (b[metric] ?? 0) - (a[metric] ?? 0),
  )[0];
  const showMine = myBest && !topIds.has(`${myBest.user_id}/${myBest.slot_id}`);

  return (
    <Screen title="Leaderboards">
      <Tabs<BoardMode>
        tabs={[
          { key: "career", label: "Careers" },
          { key: "manager", label: "Managers" },
        ]}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setMetric(METRICS[m][0].key);
        }}
      />
      <Row gap={8} style={{ flexWrap: "wrap" }}>
        {METRICS[mode].map((m) => {
          const active = m.key === metric;
          return (
            <Pressable
              key={m.key}
              onPress={() => setMetric(m.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={{
                paddingHorizontal: 14,
                minHeight: 40,
                justifyContent: "center",
                borderRadius: 20,
                borderWidth: 1,
                borderColor: active ? colors.accent : colors.border,
                backgroundColor: active
                  ? alpha(colors.accent, 0.12)
                  : colors.card,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 13,
                  color: active ? colors.accent : colors.muted,
                }}
              >
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </Row>

      {status === "off" && (
        <Card>
          <T muted>
            Leaderboards need accounts, which this version of the game does not
            have.
          </T>
        </Card>
      )}
      {status === "guest" && (
        <Pressable onPress={() => router.push("/account/sign-in")}>
          <Card glow={colors.accent}>
            <Row gap={10}>
              <Icon name="trophy-outline" size={20} color={colors.accent} />
              <T style={{ flex: 1, fontSize: 13 }}>
                Sign in to put your own careers on the board.
              </T>
              <Icon name="chevron-forward" size={18} color={colors.muted} />
            </Row>
          </Card>
        </Pressable>
      )}

      {status !== "off" && (
        <Card>
          {rows === null && !error && (
            <ActivityIndicator
              color={colors.accent}
              style={{ paddingVertical: 24 }}
            />
          )}
          {error && <T muted>{error}</T>}
          {rows && rows.length === 0 && !error && (
            <T muted>
              Nobody is on this board yet. Play a season with an account to
              claim the top spot.
            </T>
          )}
          {rows?.map((r, i) => (
            <BoardLine
              key={`${r.user_id}/${r.slot_id}`}
              r={r}
              rank={i + 1}
              metric={metric}
              mine={r.user_id === user}
            />
          ))}
          {showMine && (
            <>
              <View
                style={{
                  height: 1,
                  backgroundColor: colors.border,
                  marginVertical: 6,
                }}
              />
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 11,
                  color: colors.muted,
                  letterSpacing: 1.2,
                }}
              >
                YOUR BEST
              </Text>
              <BoardLine r={myBest} rank={null} metric={metric} mine />
            </>
          )}
        </Card>
      )}
      <T muted style={{ fontSize: 12, textAlign: "center" }}>
        {"Numbers come from players' own saves and update when a save syncs."}
      </T>
    </Screen>
  );
}
