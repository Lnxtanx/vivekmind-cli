/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { StreamingState } from '../types.js';
import { useTimer } from './useTimer.js';
import { usePhraseCycler } from './usePhraseCycler.js';
import { useState, useEffect, useRef } from 'react';

export const useLoadingIndicator = (
  streamingState: StreamingState,
  customWittyPhrases?: string[],
  currentCandidatesTokens?: number,
) => {
  const [timerResetKey, setTimerResetKey] = useState(0);
  const isTimerActive = streamingState === StreamingState.Responding;

  const elapsedTimeFromTimer = useTimer(isTimerActive, timerResetKey);

  const isPhraseCyclingActive = streamingState === StreamingState.Responding;
  const isWaiting = streamingState === StreamingState.WaitingForConfirmation;
  const currentLoadingPhrase = usePhraseCycler(
    isPhraseCyclingActive,
    isWaiting,
    customWittyPhrases,
  );

  const [retainedElapsedTime, setRetainedElapsedTime] = useState(0);
  const [taskStartTokens, setTaskStartTokens] = useState(0);
  const prevStreamingStateRef = useRef<StreamingState | null>(null);

  useEffect(() => {
    const prev = prevStreamingStateRef.current;

    // Multi-turn: WaitingForConfirmation → Responding continues the same
    // logical task — only reset timer, not the token baseline. This prevents
    // the per-task delta display from flashing to 0 between tool rounds.
    if (
      prev === StreamingState.WaitingForConfirmation &&
      streamingState === StreamingState.Responding
    ) {
      setTimerResetKey((prevKey) => prevKey + 1);
      setRetainedElapsedTime(0);
      // Intentionally NOT resetting taskStartTokens here so the
      // "↓ N tokens" counter stays continuous across tool rounds.
    } else if (
      streamingState === StreamingState.Idle &&
      prev === StreamingState.Responding
    ) {
      setTimerResetKey((prevKey) => prevKey + 1);
      setRetainedElapsedTime(0);
      setTaskStartTokens(0);
    } else if (
      streamingState === StreamingState.Responding &&
      prev !== StreamingState.Responding
    ) {
      setTaskStartTokens(currentCandidatesTokens ?? 0);
    } else if (streamingState === StreamingState.WaitingForConfirmation) {
      setRetainedElapsedTime(elapsedTimeFromTimer);
    }

    prevStreamingStateRef.current = streamingState;
  }, [streamingState, elapsedTimeFromTimer, currentCandidatesTokens]);

  return {
    elapsedTime:
      streamingState === StreamingState.WaitingForConfirmation
        ? retainedElapsedTime
        : elapsedTimeFromTimer,
    currentLoadingPhrase,
    taskStartTokens,
  };
};
