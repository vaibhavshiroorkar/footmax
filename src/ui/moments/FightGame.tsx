import React from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Button, Row, T } from '../kit';
import { colors } from '../theme';
import { RefereeFigure, RigFigure, useLooks } from '../rig/Figure';
import { playOn } from '../rig/poses';

// He is in your face. Walk away and it nearly always ends there. Square up and
// a cool head might get away with it, a hot one will see red.
export function FightGame({ rival, onDone }: { rival: string; onDone: (choice: 'walk' | 'square') => void }) {
  const looks = useLooks();
  const you = looks.me;
  const push = (dir: number) => ({ hip: { x: 0, y: -26 }, lean: dir * 0.2, handL: { x: dir * 12 - 12, y: -44 }, handR: { x: dir * 12 + 12, y: -44 }, footL: { x: -7, y: 0 }, footR: { x: 7, y: 0 } });
  return (
    <View style={{ gap: 10 }}>
      <View style={{ borderRadius: 14, overflow: 'hidden' }}>
        <Svg width="100%" height={170} viewBox="-90 -84 180 96">
          <Rect x={-90} y={-84} width={180} height={96} fill={colors.pitch} />
          <RigFigure x={-34} ground={2} h={60} pose={push(1)} kit={looks.own} skin={you?.skin} hair={you ? you.hair : undefined} boots={you?.boots} />
          <RigFigure x={34} ground={2} h={60} pose={push(-1)} kit={looks.opp} />
          <RefereeFigure x={0} ground={6} h={54} pose={playOn()} />
        </Svg>
      </View>
      <T bold style={{ textAlign: 'center' }}>{rival} is in your face.</T>
      <Row>
        <Button label="Walk away" variant="secondary" style={{ flex: 1 }} onPress={() => onDone('walk')} />
        <Button label="Square up" variant="gold" style={{ flex: 1 }} onPress={() => onDone('square')} />
      </Row>
    </View>
  );
}
