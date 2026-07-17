const SIZE = 9;
const BOX = 3;

function createEmptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isValidPlacement(grid, row, col, num) {
  for (let i = 0; i < SIZE; i++) {
    if (grid[row][i] === num || grid[i][col] === num) return false;
  }
  const br = Math.floor(row / BOX) * BOX;
  const bc = Math.floor(col / BOX) * BOX;
  for (let r = br; r < br + BOX; r++) {
    for (let c = bc; c < bc + BOX; c++) {
      if (grid[r][c] === num) return false;
    }
  }
  return true;
}

function solveSudoku(grid) {
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (grid[row][col] === 0) {
        for (const num of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
          if (isValidPlacement(grid, row, col, num)) {
            grid[row][col] = num;
            if (solveSudoku(grid)) return true;
            grid[row][col] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

export function generateSudoku(cellsToRemove = 45) {
  const grid = createEmptyGrid();
  solveSudoku(grid);
  const solution = grid.map((row) => [...row]);
  const puzzle = grid.map((row) => [...row]);

  let removed = 0;
  const positions = shuffle(
    Array.from({ length: 81 }, (_, i) => ({ r: Math.floor(i / 9), c: i % 9 }))
  );

  for (const { r, c } of positions) {
    if (removed >= cellsToRemove) break;
    if (puzzle[r][c] !== 0) {
      puzzle[r][c] = 0;
      removed++;
    }
  }

  return { puzzle, solution };
}

export function flattenGrid(grid) {
  return grid.flat();
}

export function unflattenGrid(flat) {
  const grid = [];
  for (let r = 0; r < SIZE; r++) {
    grid.push(flat.slice(r * SIZE, r * SIZE + SIZE));
  }
  return grid;
}

export function ensureGrid(value) {
  if (!value || !Array.isArray(value)) return value;
  return Array.isArray(value[0]) ? value : unflattenGrid(value);
}

export function flattenBoards(boards) {
  const result = {};
  for (const [uid, board] of Object.entries(boards || {})) {
    result[uid] = Array.isArray(board?.[0]) ? flattenGrid(board) : board;
  }
  return result;
}

export function unflattenBoards(boards) {
  const result = {};
  for (const [uid, board] of Object.entries(boards || {})) {
    result[uid] = ensureGrid(board);
  }
  return result;
}

export function countSolvedCells(board, solution, puzzle) {
  let count = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (puzzle[r][c] === 0 && board[r][c] === solution[r][c]) {
        count++;
      }
    }
  }
  return count;
}

export function isBoardComplete(board, solution, puzzle) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (puzzle[r][c] === 0 && board[r][c] !== solution[r][c]) {
        return false;
      }
    }
  }
  return true;
}

export { SIZE };
