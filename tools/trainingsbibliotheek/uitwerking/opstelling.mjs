/* Vaste opstellingen voor partijen waarvan de oude tekening de spelers op een raster had staan. [20261116i]
   Eigen team (rood) valt naar boven aan. Nummers: eerst het eigen team, dan de tegenstander. */
import { P } from '../hulp.mjs';
const T = 'tegen', K = 'keeper', J = 'joker';
/* 3 tegen 3 */
export const DRIE = [P(1, 28, 78), P(2, 56, 72), P(3, 78, 80), P(4, 30, 40, T), P(5, 54, 30, T), P(6, 76, 42, T)];
/* 4 tegen 4 zonder keepers */
export const VIER = [P(1, 30, 80), P(2, 70, 80), P(3, 40, 58), P(4, 62, 46), P(5, 34, 40, T), P(6, 66, 34, T), P(7, 48, 22, T), P(8, 54, 66, T)];
/* 4 tegen 4 met twee jokers aan de zijkant (9, 10) */
export const VIER_J = [...VIER, P(9, 5, 50, J), P(10, 95, 50, J)];
/* 5 tegen 5 zonder keepers */
export const VIJF = [P(1, 26, 82), P(2, 74, 82), P(3, 50, 68), P(4, 30, 48), P(5, 70, 44), P(6, 30, 24, T), P(7, 70, 22, T), P(8, 50, 34, T), P(9, 40, 58, T), P(10, 62, 60, T)];
/* 5 tegen 5 met keepers (1 en 6) */
export const VIJF_K = [P(1, 50, 95, K), P(2, 26, 78), P(3, 74, 78), P(4, 44, 58), P(5, 60, 40), P(6, 50, 5, K), P(7, 30, 24, T), P(8, 70, 26, T), P(9, 52, 46, T), P(10, 40, 66, T)];
/* 6 tegen 6 zonder keepers */
export const ZES = [P(1, 24, 80), P(2, 50, 84), P(3, 76, 80), P(4, 30, 56), P(5, 68, 58), P(6, 50, 40), P(7, 30, 22, T), P(8, 52, 16, T), P(9, 74, 22, T), P(10, 34, 46, T), P(11, 60, 48, T), P(12, 48, 66, T)];
/* 6 tegen 6 met keepers (1 en 7) */
export const ZES_K = [P(1, 50, 95, K), P(2, 24, 78), P(3, 76, 78), P(4, 50, 66), P(5, 30, 44), P(6, 70, 42), P(7, 50, 5, K), P(8, 28, 24, T), P(9, 72, 24, T), P(10, 50, 36, T), P(11, 38, 58, T), P(12, 62, 60, T)];
/* 7 tegen 7 met keepers (1 en 8) */
export const ZEVEN_K = [P(1, 50, 95, K), P(2, 24, 80), P(3, 76, 80), P(4, 50, 68), P(5, 26, 50), P(6, 74, 50), P(7, 50, 36), P(8, 50, 5, K), P(9, 28, 26, T), P(10, 72, 26, T), P(11, 50, 20, T), P(12, 36, 44, T), P(13, 64, 46, T), P(14, 50, 58, T)];
/* 8 tegen 8 met keepers (1 en 9): 1-3-3-1 tegen 1-3-3-1 */
export const ACHT_K = [P(1, 50, 95, K), P(2, 22, 80), P(3, 50, 82), P(4, 78, 80), P(5, 26, 56), P(6, 50, 60), P(7, 74, 56), P(8, 50, 34), P(9, 50, 5, K), P(10, 24, 22, T), P(11, 50, 18, T), P(12, 76, 22, T), P(13, 30, 42, T), P(14, 52, 46, T), P(15, 72, 42, T), P(16, 50, 68, T)];
/* 11 tegen 11 (1-4-3-3 tegen 1-4-3-3) */
export const ELF = [P(1, 50, 96, K), P(2, 14, 80), P(3, 38, 84), P(4, 62, 84), P(5, 86, 80), P(6, 30, 62), P(7, 50, 68), P(8, 70, 62), P(9, 18, 40), P(10, 50, 36), P(11, 82, 40),
  P(12, 50, 4, K), P(13, 16, 22, T), P(14, 40, 18, T), P(15, 60, 18, T), P(16, 84, 22, T), P(17, 32, 44, T), P(18, 52, 50, T), P(19, 68, 44, T), P(20, 20, 66, T), P(21, 50, 76, T), P(22, 80, 66, T)];
/* 9 tegen 9 met keepers (1 en 10): 1-3-3-2 tegen 1-3-3-2 */
export const NEGEN_K = [P(1, 50, 95, K), P(2, 20, 80), P(3, 50, 83), P(4, 80, 80), P(5, 24, 58), P(6, 50, 62), P(7, 76, 58), P(8, 38, 38), P(9, 64, 36),
  P(10, 50, 5, K), P(11, 22, 22, T), P(12, 50, 18, T), P(13, 78, 22, T), P(14, 28, 44, T), P(15, 52, 48, T), P(16, 72, 44, T), P(17, 40, 66, T), P(18, 62, 68, T)];
