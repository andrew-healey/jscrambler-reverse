var p8 = 16;
for (; p8 !== 18;) {
  switch (p8) {
    case 16:
      const P7 = 1.5 * Math["random"]() * F9 * v1 * Util["randomChoice"]([-1, 1]);
      var M$;
      p8 = 24;
      break;
    case 24:
      p8 = C8 < 0 ? 3 : 25;
      break;
    case 25:
      p8 = C8 > 0 ? 10 : 13;
      break;
    case 3:
      M$ = y_ > 0 ? SPRITES["PLAYER_UPHILL_LEFT"] : SPRITES["PLAYER_LEFT"];
      p8 = 29;
      break;
    case 29:
      Render["sprite"](k4, s9, w7, v1, E9, K5, M$, q8, e1, g0 + P7, -.5, -1);
      p8 = 18;
      break;
    case 10:
      M$ = y_ > 0 ? SPRITES["PLAYER_UPHILL_RIGHT"] : SPRITES["PLAYER_RIGHT"];
      p8 = 29;
      break;
    case 13:
      M$ = y_ > 0 ? SPRITES["PLAYER_UPHILL_STRAIGHT"] : SPRITES["PLAYER_STRAIGHT"];
      p8 = 29;
      break;
  }
}
