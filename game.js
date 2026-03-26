const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diagonals
];

let board = Array(9).fill(null);
let currentPlayer = 'X';
let gameOver = false;
let scores = { X: 0, O: 0, draws: 0 };

const cells = document.querySelectorAll('.cell');
const statusEl = document.getElementById('status');
const resetBtn = document.getElementById('reset');
const xWinsEl = document.getElementById('x-wins');
const oWinsEl = document.getElementById('o-wins');
const drawsEl = document.getElementById('draws');

cells.forEach(cell => cell.addEventListener('click', handleClick));
resetBtn.addEventListener('click', resetGame);

function handleClick(e) {
  const index = parseInt(e.target.dataset.index);
  if (gameOver || board[index]) return;

  board[index] = currentPlayer;
  renderCell(cells[index], currentPlayer);

  const winningCombo = getWinner();
  if (winningCombo) {
    highlightWinner(winningCombo);
    scores[currentPlayer]++;
    updateScoreboard();
    statusEl.textContent = `Player ${currentPlayer} wins!`;
    statusEl.classList.add('winner');
    gameOver = true;
    disableBoard();
  } else if (board.every(Boolean)) {
    scores.draws++;
    updateScoreboard();
    statusEl.textContent = "It's a draw!";
    statusEl.classList.add('winner');
    gameOver = true;
  } else {
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    statusEl.textContent = `Player ${currentPlayer}'s turn`;
  }
}

function renderCell(cell, player) {
  cell.textContent = player;
  cell.classList.add(player.toLowerCase());
  cell.disabled = true;
}

function getWinner() {
  return WINNING_COMBOS.find(combo =>
    combo.every(i => board[i] === currentPlayer)
  ) || null;
}

function highlightWinner(combo) {
  combo.forEach(i => cells[i].classList.add('winning'));
}

function disableBoard() {
  cells.forEach(cell => (cell.disabled = true));
}

function updateScoreboard() {
  xWinsEl.textContent = scores.X;
  oWinsEl.textContent = scores.O;
  drawsEl.textContent = scores.draws;
}

function resetGame() {
  board = Array(9).fill(null);
  currentPlayer = 'X';
  gameOver = false;
  statusEl.textContent = `Player X's turn`;
  statusEl.classList.remove('winner');
  cells.forEach(cell => {
    cell.textContent = '';
    cell.className = 'cell';
    cell.disabled = false;
  });
}
