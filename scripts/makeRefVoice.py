"""Builds the referee's voice into assets/sounds/ref-*.wav.

The raw lines come from Piper with the en_US-norman voice, whose recordings are
public domain (LibriVox). Piper itself is only a tool here and is not shipped.
This script turns each line into a shout heard across a stadium: higher, driven
and with a short echo.

Usage: python scripts/makeRefVoice.py <python-with-piper> <voice.onnx>
"""
import math
import os
import struct
import subprocess
import sys
import tempfile
import wave

LINES = {
    'penalty': 'penalty',
    'freekick': 'free kick',
    'corner': 'corner',
    'offside': 'offside',
    'playon': 'play on',
    'goalkick': 'goal kick',
    'nogoal': 'no goal',
    'handball': 'handball',
    'off': 'off you go',
}
RATE = 22050
TAKES = 6
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')


def read(path):
    with wave.open(path, 'rb') as w:
        raw = w.readframes(w.getnframes())
        rate = w.getframerate()
    return [v / 32768 for v in struct.unpack(f'<{len(raw) // 2}h', raw)], rate


def trim(x):
    # By energy, not by sample: Piper leaves long, faintly noisy tails.
    win = int(RATE * 0.02)
    levels = [math.sqrt(sum(v * v for v in x[i:i + win]) / max(1, len(x[i:i + win]))) for i in range(0, len(x), win)]
    top = max(levels) or 1
    loud = [i for i, v in enumerate(levels) if v > top * 0.12]
    if not loud:
        return x
    return x[max(0, loud[0] * win - 150):min(len(x), (loud[-1] + 1) * win + 300)]


def resample(x, ratio):
    out = []
    n = int(len(x) / ratio)
    for i in range(n):
        p = i * ratio
        a = int(p)
        b = min(a + 1, len(x) - 1)
        out.append(x[a] + (x[b] - x[a]) * (p - a))
    return out


def high_pass(x, hz):
    k = 1 / (1 + 2 * math.pi * hz / RATE)
    out = []
    prev_in = prev_out = 0.0
    for v in x:
        prev_out = k * (prev_out + v - prev_in)
        prev_in = v
        out.append(prev_out)
    return out


def echo(x):
    taps = [(0.09, 0.26), (0.17, 0.14), (0.29, 0.07)]
    tail = int(RATE * 0.35)
    out = x + [0.0] * tail
    for delay, gain in taps:
        d = int(RATE * delay)
        for i, v in enumerate(x):
            out[i + d] += v * gain
    return out


def shout(x, rate):
    # Up in pitch and quicker, as a raised voice is.
    x = resample(x, (rate / RATE) * 1.12)
    x = trim(x)
    x = high_pass(x, 220)
    top = max(abs(v) for v in x) or 1
    x = [math.tanh(v / top * 2.6) for v in x]
    x = echo(x)
    fade = int(RATE * 0.08)
    for i in range(fade):
        x[-1 - i] *= i / fade
    top = max(abs(v) for v in x) or 1
    return [v / top * 0.8 for v in x]


def main():
    python, voice = sys.argv[1], sys.argv[2]
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for name, text in LINES.items():
            # Takes vary, so make a few and keep the tightest.
            takes = []
            for take in range(TAKES):
                raw = os.path.join(tmp, f'{name}{take}.wav')
                subprocess.run([python, '-m', 'piper', '-m', voice, '--length-scale', '0.8', '--noise-scale', '0.45', '--noise-w-scale', '0.5', '-f', raw], input=text.encode(), check=True, capture_output=True)
                takes.append(shout(*read(raw)))
            done = min(takes, key=len)
            with wave.open(os.path.join(OUT, f'ref-{name}.wav'), 'wb') as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(RATE)
                w.writeframes(b''.join(struct.pack('<h', int(v * 32767)) for v in done))
            print(name, f'{len(done) / RATE:.2f}s')


if __name__ == '__main__':
    main()
