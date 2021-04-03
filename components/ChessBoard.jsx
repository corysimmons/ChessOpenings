import React from 'react';
import dynamic from 'next/dynamic';

import Chess from 'chess.js';

import ChessBoardHeader from './ChessBoardHeader';
import DebugPanel from '../components/panels/DebugPanel';
import Panel from './Panel';
import SubmissionPanel from './panels/SubmissionPanel';
import TrapsPanel from './panels/TrapsPanel';
import { chessPieces, start } from '../data/consts';
import { useChessboardSize } from '../functions/hooks';
import { useStoreContext } from './Store';

const Board = dynamic(import('chessboardjsx'), { ssr: false });

// https://react-select.com/components#option -> custom option example, on hover show tooltip that contains final opening layout, add final fen into data structure so it can read that

// on mobile select menu closes after each selection
// on mobile its a bit slow to drop a piece
// make a PWA - https://github.com/shadowwalker/next-pwa - https://github.com/vercel/next.js/tree/canary/examples/progressive-web-app - https://www.creativebloq.com/how-to/build-a-progressive-web-app

// Contact/Suggest Opening fix page with links to message me on twitter or make a PR
// Prettify debug mode
// Suggestions and upcoming work/openings page
// Show captured pieces underneath board
// Analysis weighting at all points, display somewhere
// Openings Mistakes, Take advantage
// Known Mistakes:
//  Evans Gambit: 5. c3, bc5
//  Two Knights Defence: 6. d5
//  Traxler: 6. xf2 && 8. bxd5 -> bg4 queen trap
// On learn page, export pgn -> https://github.com/jhlywa/chess.js/blob/master/README.md#pgn-options-
//  Link on each trap to theory way to play
// Home Page, Contribute Page, 404 Page
// Split ChessBoard and Panel
// Change Font and colours
// Make repo public
// Start/End sounds + checkmate sound
// Chess24/chessable themes
// Cookie/Storage warning
// Contribute page -> gives explanation etc, then link to debug page that when you click done on, returns to contribute page with object in local storage that fills the form out
// Submitting contribution posts to api which adds suggestion as new issue in GitHub, return link to user so they can follow any updates
// Rename sidebar to navbar
// Refactor Components into folders and reusable components: Button
// On navbar, have Learn Train and Traps links in larger font
// store debug moves in Store instead of local storage? argument for storage is that they can leave and come back and it will still be there
// analytics https://nextjs.org/docs/advanced-features/measuring-performance
// Chessboard headings
// get side panel should be a component which you pass all props to, and inside it is the switch case, just to shorten the length of this file
// Contribute form should have userColour option for traps

// https://kumarabhirup.me/writings/google-recaptcha-react-node-js
// move everything over to firebase?
// also rate limit per IP address on firebase incase someone just likes to spam fill out captchas
// suggestions have their own page, and can have comments left, link sent to contributer
// password protected admin page when i can comment/approve/reject openings, using password protected API routes (i can phsically send the password this time)

export default function ChessBoard({ path, isDebug }) {
  const chessboardSize = useChessboardSize();
  const { state } = useStoreContext();

  const [game, setGame] = React.useState();
  const [opening, setOpening] = React.useState();
  const [loadingGame, setLoadingGame] = React.useState(false);
  const [openingComplete, setOpeningComplete] = React.useState(false);
  const [openingError, setOpeningError] = React.useState(false);

  const [redoStack, setRedoStack] = React.useState([]);
  const [undoMade, setUndoMade] = React.useState(false);
  const [navDisabled, setNavDisabled] = React.useState(false);
  const [showBoard, setShowBoard] = React.useState(true);

  const [moveSounds, setMoveSounds] = React.useState([]);
  const [userColor, setUserColor] = React.useState('white');
  const [boardOrientation, setBoardOrientation] = React.useState(userColor);

  const [rightClickedSquares, setRightClickedSquares] = React.useState({});
  const [moveSquares, setMoveSquares] = React.useState({});
  const [optionSquares, setOptionSquares] = React.useState({});

  // initialise
  React.useEffect(() => {
    setGame(new Chess());
    setSounds();
  }, []);

  // handle theme change
  React.useEffect(() => {
    setShowBoard(false);
    setSounds();
    setTimeout(() => {
      setShowBoard(true);
    }, 10);
  }, [state.theme]);

  React.useEffect(() => {
    // if user is starting with black then CPU makes opening move
    if (game?.fen() === start && userColor === 'black' && opening) {
      setTimeout(
        () => {
          makeComputerMove(opening.value[game.history().length].from, opening.value[game.history().length].to);
        },
        state.animationsOn.value ? 500 : 50
      );
      return;
    }

    // if move is undone and its CPU turn next, make CPU move
    if (
      undoMade &&
      game?.history({ verbose: true })[game.history().length - 1]?.color === userColor[0] &&
      opening?.value[game.history().length] !== undefined
    ) {
      makeComputerMove(opening.value[game.history().length].from, opening.value[game.history().length].to);
      redoStack.pop();
    }

    // if move is undone and its CPU turn next, make CPU move
    if (opening && path === '/submission' && !loadingGame) {
      setLoadingGame(true);
      loadGame();
    }

    setUndoMade(false);
  }, [game, undoMade, userColor, opening]);

  function loadGame() {
    opening.value.forEach((move) => {
      safeGameMutate((game) => {
        game.move({ from: move.from, to: move.to });
      });
    });
  }

  // safely update game in useState
  function safeGameMutate(modify) {
    setGame((game) => {
      const update = { ...game };
      modify(update);
      return update;
    });
  }

  // reset game state
  function reset() {
    safeGameMutate((game) => {
      game.reset();
    });
    setRedoStack([]);
    setRightClickedSquares({});
    setMoveSquares({});
    setOptionSquares({});
  }

  function setSounds() {
    setMoveSounds({
      move: new Audio(`/media/themes/${state.theme.value}/move.mp3`),
      capture: new Audio(`/media/themes/${state.theme.value}/capture.mp3`),
      check: new Audio(`/media/themes/${state.theme.value}/check.mp3`),
      castle: new Audio(`/media/themes/${state.theme.value}/castle.mp3`),
      error: new Audio(`/media/themes/${state.theme.value}/error.flac`)
    });
  }

  // play sound on moves
  function playSound() {
    const move = game.history({ verbose: true })[game.history().length - 1];
    if (game.in_check() || game.in_checkmate()) {
      moveSounds.check.play();
      return;
    }
    if (move.captured) {
      moveSounds.capture.play();
      return;
    }
    if (
      (move.from === 'e1' && (move.to === 'g1' || move.to === 'c1')) ||
      (move.from === 'e8' && (move.to === 'g8' || move.to === 'c8'))
    ) {
      moveSounds.castle.play();
      return;
    }

    moveSounds.move.play();
  }

  function goBack() {
    const history = game.history({ verbose: true });
    const lastMoveIndex = history.length - 1;
    const targetMoveIndex = history.length - 2;
    const lastFrom = history[lastMoveIndex].from;
    const lastTo = history[lastMoveIndex].to;
    const lastColor = history[lastMoveIndex].color;
    const targetFrom = history[targetMoveIndex].from;
    const targetTo = history[targetMoveIndex].to;
    const targetColor = history[targetMoveIndex].color;

    redoStack.push({
      from: lastFrom,
      to: lastTo,
      color: lastColor
    });
    redoStack.push({
      from: targetFrom,
      to: targetTo,
      color: targetColor
    });

    setUndoMade(true);
    safeGameMutate((game) => {
      // go back twice to go back past CPU move
      game.undo();
      game.undo();
    });
    moveSounds.move.play();

    // colour move squares of move made prior to 2 moves ago
    const priorMoveIndex = history.length - 3;
    if (priorMoveIndex > -1) {
      const priorFrom = history[priorMoveIndex].from;
      const priorTo = history[priorMoveIndex].to;
      setMoveSquares({
        [priorFrom]: {
          backgroundColor: 'rgba(255, 255, 0, 0.4)'
        },
        [priorTo]: {
          backgroundColor: 'rgba(255, 255, 0, 0.4)'
        }
      });
    } else setMoveSquares({});
  }

  function goForward() {
    setNavDisabled(true);
    const redoMove = redoStack.pop();
    safeGameMutate((game) => {
      game.move(redoMove);
    });
    setTimeout(
      () => {
        playSound();
      },
      state.animationsOn.value ? 300 : 100
    );
    setMoveSquares({
      [redoMove.from]: {
        backgroundColor: 'rgba(255, 255, 0, 0.4)'
      },
      [redoMove.to]: {
        backgroundColor: 'rgba(255, 255, 0, 0.4)'
      }
    });

    // 2nd condition was previously: opening.value[game.history().length - 1]
    // have removed the -1 and all still seems to work and bug has disappeared:
    // Bug found: as white - italian, first move made, click back, then forward, and CPU won't make move when it should
    if (
      redoStack.length > 0 &&
      opening?.value[game.history().length] !== undefined &&
      redoStack[redoStack.length - 1].color !== userColor[0]
    ) {
      const move = redoStack.pop();
      setTimeout(
        () => {
          // TODO: why the timeout?
          makeComputerMove(move.from, move.to);
        },
        state.animationsOn.value ? 300 : 100
      );
    } else setNavDisabled(false);
  }

  function makeComputerMove(from, to) {
    safeGameMutate((game) => {
      game.move({ from, to });
    });
    setMoveSquares({
      [from]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' },
      [to]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' }
    });
    setTimeout(
      () => {
        playSound();
        setNavDisabled(false);
        if (opening.value[game.history().length] === undefined) setOpeningComplete(true);
      },
      state.animationsOn.value ? 300 : 100
    );
  }

  function onDrop({ sourceSquare, targetSquare }) {
    // no opening has been selected yet so prevent anything happening
    if (!opening) return;

    // make move if valid, otherwise do nothing and return
    const move = game.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q'
    });
    if (move === null) return;

    const historyLength = game.history().length;

    // if still in opening and incorrect move made
    if (
      opening.value[game.history().length - 1] !== undefined &&
      (sourceSquare !== opening.value[historyLength - 1].from || targetSquare !== opening.value[historyLength - 1].to)
    ) {
      safeGameMutate((game) => {
        game.undo();
      });
      moveSounds.error.play();
      setRightClickedSquares({});
      setOptionSquares({});
      setOpeningError(true);
      setMoveSquares({
        [sourceSquare]: { backgroundColor: 'rgba(255, 0, 0, 0.4)' },
        [targetSquare]: { backgroundColor: 'rgba(255, 0, 0, 0.4)' }
      });
      return;
    }

    playSound();
    setRedoStack([]);
    setRightClickedSquares({});
    setMoveSquares({
      [sourceSquare]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' },
      [targetSquare]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' }
    });

    if (opening.value[historyLength] !== undefined) {
      makeComputerMove(opening.value[historyLength].from, opening.value[historyLength].to);
    } else setOpeningComplete(true);
  }

  // For recording moves
  function onDropDebug({ sourceSquare, targetSquare }) {
    const move = game.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q'
    });
    if (move === null) return;
    playSound();
    setMoveSquares({
      [sourceSquare]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' },
      [targetSquare]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' }
    });
    console.log(JSON.stringify(game.history({ verbose: true })));
  }

  function onSquareClick() {
    setRightClickedSquares({});
  }

  function onSquareRightClick(square) {
    const colour = 'rgba(0, 0, 255, 0.4)';
    setRightClickedSquares({
      ...rightClickedSquares,
      [square]:
        rightClickedSquares[square] && rightClickedSquares[square].backgroundColor === colour
          ? undefined
          : { backgroundColor: colour }
    });
  }

  function onMouseOverSquare(square) {
    const moves = game.moves({
      square,
      verbose: true
    });
    if (moves.length === 0) return;

    const newSquares = {};
    moves.map((move) => {
      newSquares[move.to] = {
        background:
          game.get(move.to) && game.get(move.to).color !== game.get(square).color
            ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)'
            : 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
        borderRadius: '50%'
      };
      return move;
    });
    newSquares[square] = {
      background: 'rgba(255, 255, 0, 0.4)'
    };
    setOptionSquares(newSquares);
  }

  // Only set squares to {} if not already set to {}
  function onMouseOutSquare() {
    if (Object.keys(optionSquares).length !== 0) setOptionSquares({});
  }

  function getSidePanel() {
    switch (path) {
      case '/debug':
        return (
          <DebugPanel
            boardOrientation={boardOrientation}
            game={game}
            goBack={goBack}
            goForward={goForward}
            navDisabled={navDisabled}
            opening={opening}
            redoStack={redoStack}
            reset={reset}
            setBoardOrientation={setBoardOrientation}
            setOpening={setOpening}
            setUserColor={setUserColor}
            userColor={userColor}
          />
        );
      case '/submission':
        return (
          <SubmissionPanel
            boardOrientation={boardOrientation}
            game={game}
            goBack={goBack}
            goForward={goForward}
            navDisabled={navDisabled}
            opening={opening}
            openingComplete={openingComplete}
            openingError={openingError}
            path={path}
            redoStack={redoStack}
            reset={reset}
            setBoardOrientation={setBoardOrientation}
            setOpening={setOpening}
            setOpeningComplete={setOpeningComplete}
            setOpeningError={setOpeningError}
            setUserColor={setUserColor}
            userColor={userColor}
          />
        );
      case '/traps':
        return (
          <TrapsPanel
            boardOrientation={boardOrientation}
            game={game}
            goBack={goBack}
            goForward={goForward}
            navDisabled={navDisabled}
            opening={opening}
            redoStack={redoStack}
            reset={reset}
            setBoardOrientation={setBoardOrientation}
            setOpening={setOpening}
            setUserColor={setUserColor}
            userColor={userColor}
          />
        );
      default:
        return (
          <Panel
            boardOrientation={boardOrientation}
            game={game}
            goBack={goBack}
            goForward={goForward}
            navDisabled={navDisabled}
            opening={opening}
            openingComplete={openingComplete}
            openingError={openingError}
            path={path}
            redoStack={redoStack}
            reset={reset}
            setBoardOrientation={setBoardOrientation}
            setOpening={setOpening}
            setOpeningComplete={setOpeningComplete}
            setOpeningError={setOpeningError}
            setUserColor={setUserColor}
            userColor={userColor}
          />
        );
    }
  }

  return (
    <div className="board-panel-container">
      <div id="chessboard" className="chessboard">
        <ChessBoardHeader path={path} opening={opening} />
        {showBoard && (
          <Board
            id="board"
            position={game ? game.fen() : start}
            orientation={boardOrientation}
            darkSquareStyle={state.theme.darkSquareStyle}
            lightSquareStyle={state.theme.lightSquareStyle}
            dropSquareStyle={{
              boxShadow: 'inset 0 0 1px 6px rgba(255,255,255,0.75)'
            }}
            squareStyles={{
              ...rightClickedSquares,
              ...moveSquares,
              ...optionSquares
            }}
            onDrop={isDebug ? onDropDebug : onDrop}
            onSquareClick={onSquareClick}
            onSquareRightClick={onSquareRightClick}
            onMouseOverSquare={onMouseOverSquare}
            onMouseOutSquare={onMouseOutSquare}
            width={chessboardSize}
            transitionDuration={state.animationsOn.value ? 300 : 0}
            pieces={chessPieces(state.theme.value)}
          />
        )}
      </div>
      {getSidePanel()}
    </div>
  );
}
