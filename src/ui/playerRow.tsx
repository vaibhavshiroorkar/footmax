import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Player } from '../engine/types';
import { formatMoney, marketValue, overall, shortName } from '../engine/player';
import { Icon, Row, haptic } from './kit';
import { alpha, colors, fonts, POSITION_COLORS, ratingColor } from './theme';

export function PlayerRow({ p, onPress, selected, right, note }: { p: Player; onPress?: () => void; selected?: boolean; right?: string; note?: string }) {
  const ovr = overall(p);
  const posColor = POSITION_COLORS[p.position];
  return (
    <Pressable
      onPress={
        onPress &&
        (() => {
          haptic();
          onPress();
        })
      }
      style={({ pressed }) => ({
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 12,
        backgroundColor: selected ? alpha(colors.accent, 0.1) : pressed ? colors.cardAlt : 'transparent',
        borderWidth: 1,
        borderColor: selected ? colors.accent : 'transparent',
      })}
    >
      <Row gap={10}>
        <View style={{ width: 38, paddingVertical: 4, borderRadius: 8, backgroundColor: alpha(posColor, 0.15), alignItems: 'center' }}>
          <Text style={{ color: posColor, fontFamily: fonts.bold, fontSize: 11 }}>{p.role ?? p.position}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Row gap={5}>
            <Text style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 14 }} numberOfLines={1}>
              {shortName(p)}
            </Text>
            {p.injuryWeeks > 0 && <Icon name="medkit" size={12} color={colors.red} />}
            {p.fitness < 60 && !p.injuryWeeks && <Icon name="battery-dead" size={12} color={colors.gold} />}
            {p.listed && <Icon name="pricetag" size={12} color={colors.gold} />}
            {p.loan && <Icon name="repeat" size={12} color={colors.teal} />}
          </Row>
          <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 11.5 }} numberOfLines={1}>
            Age {p.age}
            {note ? `  |  ${note}` : ''}
          </Text>
        </View>
        {right !== '' && (
          <Text style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 12, textAlign: 'right', minWidth: 58 }}>{right ?? formatMoney(marketValue(p))}</Text>
        )}
        <View style={{ width: 38, height: 30, borderRadius: 8, backgroundColor: alpha(ratingColor(ovr), 0.16), alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: alpha(ratingColor(ovr), 0.4) }}>
          <Text style={{ color: ratingColor(ovr), fontFamily: fonts.display, fontSize: 17 }}>{ovr}</Text>
        </View>
      </Row>
    </Pressable>
  );
}
