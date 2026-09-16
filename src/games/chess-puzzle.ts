import { DifficultyLevels, type DifficultyLevel } from '../db/schema.types';
import type { TranslationKey } from '../i18n/index';
import { shuffle } from './memory-match/engine';
import type { SelectionTask } from './selection-engine';

export const chessPieces = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'] as const;
export type ChessPiece = typeof chessPieces[number];
type Piece = { kind: ChessPiece; side: 'white' | 'black' };
export type ChessBoard = Readonly<Record<string, Piece>>;
export type ChessTask = SelectionTask & {
  board: ChessBoard; source: string; target: string | null; kind: 'recognize' | 'move' | 'capture' | 'safe';
};
export const chessRoundCounts = [6, 4, 4, 3, 3] as const;
export const pieceKeys = { king: 'chessKing', queen: 'chessQueen', rook: 'chessRook', bishop: 'chessBishop', knight: 'chessKnight', pawn: 'chessPawn' } as const satisfies Record<ChessPiece, TranslationKey>;
export const movementKeys = { king: 'chessKingHint', queen: 'chessQueenHint', rook: 'chessRookHint', bishop: 'chessBishopHint', knight: 'chessKnightHint', pawn: 'chessPawnHint' } as const satisfies Record<ChessPiece, TranslationKey>;
export const chessSymbols = { white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
  black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' } } as const;
const square = (s: string) => /^[a-h][1-8]$/.test(s);
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1];

function attacks(board: ChessBoard, from: string, to: string): boolean {
  if (!square(from) || !square(to) || from === to || !board[from]) return false;
  const [x, y] = xy(from), [tx, ty] = xy(to), dx = tx - x, dy = ty - y;
  const piece = board[from], ax = Math.abs(dx), ay = Math.abs(dy);
  if (piece.kind === 'pawn') return ax === 1 && dy === (piece.side === 'white' ? 1 : -1);
  if (piece.kind === 'knight') return ax * ay === 2;
  if (piece.kind === 'king') return Math.max(ax, ay) === 1;
  if (!(piece.kind !== 'bishop' && (dx === 0 || dy === 0)) && !(piece.kind !== 'rook' && ax === ay)) return false;
  for (let step = 1; step < Math.max(ax, ay); step++) {
    if (board[String.fromCharCode(97 + x + step * Math.sign(dx)) + (y + 1 + step * Math.sign(dy))]) return false;
  }
  return true;
}
export function chessSquareAttacked(board: ChessBoard, target: string, by: Piece['side']) {
  return Object.entries(board).some(([from, piece]) => piece.side === by && attacks(board, from, target));
}
export function validChessBoard(board: ChessBoard) {
  return Object.entries(board).every(([s, p]) => square(s) && chessPieces.includes(p.kind) && ['white', 'black'].includes(p.side) &&
    (p.kind !== 'pawn' || !['1', '8'].includes(s[1]))) &&
    ['white', 'black'].every(side => Object.values(board).filter(p => p.side === side && p.kind === 'king').length === 1);
}
export function moveChessPiece(board: ChessBoard, from: string, to: string): ChessBoard {
  const moved = { ...board }; delete moved[from]; moved[to] = board[from]; return moved;
}
// Curated one-move activities never ask for castling, en passant or promotion.
export function isLegalChessMove(board: ChessBoard, from: string, to: string): boolean {
  if (!validChessBoard(board) || !square(from) || !square(to) || from === to) return false;
  const p = board[from], destination = board[to];
  if (!p || destination?.side === p.side || destination?.kind === 'king') return false;
  const [x, y] = xy(from), [tx, ty] = xy(to), direction = p.side === 'white' ? 1 : -1;
  if (p.kind === 'pawn') {
    if (ty === 0 || ty === 7) return false;
    const forward = x === tx && !destination && (ty - y === direction ||
      (y === (p.side === 'white' ? 1 : 6) && ty - y === 2 * direction && !board[from[0] + (y + 1 + direction)]));
    if (!forward && !(destination && attacks(board, from, to))) return false;
  } else if (!attacks(board, from, to)) return false;
  const moved = moveChessPiece(board, from, to);
  const king = Object.keys(moved).find(s => moved[s].side === p.side && moved[s].kind === 'king')!;
  return !chessSquareAttacked(moved, king, p.side === 'white' ? 'black' : 'white');
}
export function isChessAnswer(task: ChessTask, choice: string) {
  if (!task.choices.includes(choice)) return false;
  if (task.kind === 'recognize') return choice === task.board[task.source].kind;
  if (!isLegalChessMove(task.board, task.source, choice)) return false;
  if (task.target && choice !== task.target) return false;
  return task.kind !== 'safe' || (task.board[choice]?.side === 'black' && !chessSquareAttacked(moveChessPiece(task.board, task.source, choice), choice, 'black'));
}

export function prepareChess(level: DifficultyLevel, random: () => number = Math.random): readonly ChessTask[] {
  if (!DifficultyLevels.includes(level)) throw new Error('Invalid chess level.');
  const board = (kind: ChessPiece, source: string, extra: ChessBoard = {}): ChessBoard => ({
    a1: { kind: 'king', side: 'white' }, h7: { kind: 'king', side: 'black' },
    ...(kind === 'king' ? {} : { [source]: { kind, side: 'white' } }), ...extra,
  });
  const make = (piece: ChessPiece, source: string, choices: string[], answer: string, kind: ChessTask['kind'] = 'move', extra: ChessBoard = {}): ChessTask => ({
    id: piece + '-' + source + '-' + answer, board: board(piece, source, extra), source, kind,
    target: kind === 'capture' ? answer : null, choices: shuffle(choices, random), answer,
  });
  let tasks: ChessTask[];
  if (level === 1) tasks = chessPieces.map(piece => make(piece, piece === 'king' ? 'a1' : 'd4', [...chessPieces], piece, 'recognize'));
  else if (level === 2) tasks = [make('rook', 'd4', ['d6', 'e5', 'c3'], 'd6'), make('bishop', 'd4', ['f6', 'd6', 'e4'], 'f6'),
    make('queen', 'd4', ['g7', 'e6', 'c6'], 'g7'), make('king', 'a1', ['b2', 'c1', 'c3'], 'b2')];
  else if (level === 3) tasks = [make('knight', 'd4', ['e6', 'd6', 'e5'], 'e6'), make('pawn', 'd3', ['d4', 'e3', 'd2'], 'd4'),
    make('knight', 'b3', ['c5', 'b4', 'c4'], 'c5'), make('pawn', 'e4', ['e5', 'd5', 'e3'], 'e5')];
  else if (level === 4) tasks = [
    make('rook', 'd4', ['d6', 'c5', 'e5'], 'd6', 'capture', { d6: { kind: 'pawn', side: 'black' } }),
    make('bishop', 'c3', ['e5', 'c5', 'd3'], 'e5', 'capture', { e5: { kind: 'pawn', side: 'black' } }),
    make('knight', 'd4', ['f5', 'd5', 'e5'], 'f5', 'capture', { f5: { kind: 'pawn', side: 'black' } }),
  ];
  else tasks = [
    make('rook', 'd4', ['d6', 'f4', 'e5'], 'd6', 'safe', { d6: { kind: 'pawn', side: 'black' }, f4: { kind: 'pawn', side: 'black' }, f7: { kind: 'rook', side: 'black' } }),
    make('bishop', 'c3', ['e5', 'a5', 'c5'], 'e5', 'safe', { e5: { kind: 'pawn', side: 'black' }, a5: { kind: 'pawn', side: 'black' }, b7: { kind: 'knight', side: 'black' } }),
    make('knight', 'd4', ['b5', 'e6', 'd5'], 'b5', 'safe', { b5: { kind: 'pawn', side: 'black' }, e6: { kind: 'pawn', side: 'black' }, h6: { kind: 'rook', side: 'black' } }),
  ];
  for (const task of tasks) {
    if (!validChessBoard(task.board) || chessSquareAttacked(task.board, 'a1', 'black') || chessSquareAttacked(task.board, 'h7', 'white') ||
      task.choices.filter(choice => isChessAnswer(task, choice)).join() !== task.answer) throw new Error('Invalid chess puzzle.');
  }
  return shuffle(tasks, random);
}
