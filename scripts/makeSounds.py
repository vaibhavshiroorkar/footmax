"""Generates the game's sound effects into assets/sounds/.

Everything is synthesised from sine waves and filtered noise, so the files
are original and free to ship. Run with `python scripts/makeSounds.py`
after changing a sound; only the standard library is needed.
"""
import math
import os
import random
import struct
import wave

RATE = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')
random.seed(7)


def save(name, samples, peak=0.85):
    top = max(1e-9, max(abs(s) for s in samples))
    scale = peak / top
    os.makedirs(OUT, exist_ok=True)
    with wave.open(os.path.join(OUT, f'{name}.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, s * scale)) * 32767)) for s in samples))


def n(seconds):
    return int(RATE * seconds)


def lowpass(xs, k):
    out, y = [], 0.0
    for x in xs:
        y += k * (x - y)
        out.append(y)
    return out


def noise(count):
    return [random.uniform(-1, 1) for _ in range(count)]


def fade(xs, attack, release):
    a, r = n(attack), n(release)
    out = []
    for i, x in enumerate(xs):
        g = 1.0
        if i < a:
            g = i / a
        if i > len(xs) - r:
            g *= max(0.0, (len(xs) - i) / r)
        out.append(x * g)
    return out


# A boot on a ball: a low thump with a short slap on top.
def kick():
    count = n(0.14)
    out = []
    phase = 0.0
    slap = lowpass(noise(count), 0.5)
    for i in range(count):
        t = i / RATE
        f = 140 * math.exp(-t * 18) + 55
        phase += 2 * math.pi * f / RATE
        thump = math.sin(phase) * math.exp(-t * 26)
        out.append(thump + slap[i] * 0.5 * math.exp(-t * 90))
    return out


# The referee's whistle: a pea whistle trills at about 2.9 kHz.
def whistle(blasts):
    out = []
    phase = 0.0
    for b, length in enumerate(blasts):
        count = n(length)
        for i in range(count):
            t = i / RATE
            f = 2900 + 120 * math.sin(2 * math.pi * 28 * t)
            phase += 2 * math.pi * f / RATE
            breath = random.uniform(-1, 1) * 0.08
            env = min(1, t / 0.02) * min(1, (length - t) / 0.04)
            out.append((math.sin(phase) * 0.8 + math.sin(phase * 2) * 0.12 + breath) * env)
        out.extend([0.0] * n(0.12))
    return out


# A crowd: many voices as low-passed noise, with a slow swell.
def crowd(seconds, swell, cutoff, roar):
    count = n(seconds)
    base = lowpass(lowpass(noise(count), cutoff), cutoff * 1.4)
    out = []
    for i in range(count):
        t = i / RATE
        shape = swell(t / seconds)
        # A few voices rising above the rest.
        voices = sum(math.sin(2 * math.pi * f * t + f) for f in (230, 310, 410)) * 0.04 * roar * shape
        out.append(base[i] * shape + voices)
    return out


def tone(freq, seconds, decay=6.0, harmonics=(1.0, 0.3, 0.1)):
    count = n(seconds)
    return [sum(a * math.sin(2 * math.pi * freq * (k + 1) * i / RATE) for k, a in enumerate(harmonics)) * math.exp(-decay * i / RATE) for i in range(count)]


def mix(*parts):
    length = max(len(p) for _, p in parts)
    out = [0.0] * length
    for start, p in parts:
        for i, x in enumerate(p):
            if start + i < length:
                out[start + i] += x
    return out


def place(start, p):
    return (n(start), p)


save('kick', kick(), 0.7)
save('whistle', whistle([0.35]), 0.6)
save('whistle-end', whistle([0.3, 0.3, 0.9]), 0.6)
save('goal', fade(crowd(3.2, lambda u: min(1, u * 6) * (1 - 0.55 * u), 0.18, 1.0), 0.02, 0.6), 0.9)
save('ooh', fade(crowd(1.4, lambda u: math.sin(math.pi * min(1, u * 1.3)) * 0.9, 0.08, 0.6), 0.05, 0.3), 0.75)
save('crowd', fade(crowd(6.0, lambda u: 0.75 + 0.25 * math.sin(2 * math.pi * u * 2), 0.06, 0.2), 0.3, 0.3), 0.35)
save('reward', mix(place(0, tone(784, 0.35)), place(0.09, tone(988, 0.35)), place(0.18, tone(1175, 0.6))), 0.55)
save('fanfare', mix(place(0, tone(523, 0.3, 4)), place(0.12, tone(659, 0.3, 4)), place(0.24, tone(784, 0.3, 4)), place(0.36, tone(1047, 0.9, 3))), 0.6)
save('tap', fade(tone(1400, 0.035, 60, (1.0,)), 0.002, 0.02), 0.25)
print('sounds written to', os.path.abspath(OUT))
