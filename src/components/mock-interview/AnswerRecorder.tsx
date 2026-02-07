import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, RotateCcw, Square, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnswerTimer } from './InterviewTimer';
import { cn } from '@/lib/utils';
import type { AnswerState } from '@/lib/mock-interview-types';

interface AnswerRecorderProps {
  onComplete: (audio: Blob) => Promise<void> | void;
  answerState: AnswerState;
  onStateChange: (state: AnswerState) => void;
}

export function AnswerRecorder({ onComplete, answerState, onStateChange }: AnswerRecorderProps) {
  const [hasMediaAccess, setHasMediaAccess] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);

  const requestMediaAccess = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasMediaAccess(true);
      setIsVideoEnabled(true);
      setIsAudioEnabled(true);
    } catch (error) {
      console.error('Failed to access media devices:', error);
      // Still allow proceeding without media
      setHasMediaAccess(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const toggleVideo = useCallback(() => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, []);

  const toggleAudio = useCallback(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, []);

  const handleStart = useCallback(async () => {
    try {
      if (!streamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: hasMediaAccess });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasMediaAccess(true);
        setIsAudioEnabled(true);
        if (stream.getVideoTracks().length > 0) {
          setIsVideoEnabled(true);
        }
      }

      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(streamRef.current, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm',
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.start(250);
      onStateChange('recording');
    } catch (error) {
      console.error('Failed to start recording:', error);
      onStateChange('idle');
    }
  }, [hasMediaAccess, onStateChange]);

  const handleStop = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      return;
    }

    onStateChange('processing');
    recorder.onstop = async () => {
      const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      await onComplete(blob);
    };
    recorder.stop();
  }, [onStateChange, onComplete]);

  const handleReRecord = useCallback(() => {
    onStateChange('idle');
  }, [onStateChange]);

  const handleTimeUp = useCallback(() => {
    handleStop();
  }, [handleStop]);

  const isRecording = answerState === 'recording';
  const isProcessing = answerState === 'processing';

  return (
    <div className="space-y-4">
      {/* Video Preview */}
      <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
        {hasMediaAccess ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={cn(
              'w-full h-full object-cover',
              !isVideoEnabled && 'hidden'
            )}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <Video className="h-12 w-12" />
            <p className="text-sm">Camera preview (optional)</p>
            <Button variant="outline" size="sm" onClick={requestMediaAccess}>
              Enable Camera
            </Button>
          </div>
        )}

        {hasMediaAccess && !isVideoEnabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <VideoOff className="h-12 w-12 text-muted-foreground" />
          </div>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 bg-destructive text-destructive-foreground rounded-full text-sm font-medium">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Recording
          </div>
        )}

        {/* Media controls */}
        {hasMediaAccess && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
            <Button
              variant={isVideoEnabled ? 'secondary' : 'destructive'}
              size="icon"
              onClick={toggleVideo}
              disabled={isProcessing}
            >
              {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </Button>
            <Button
              variant={isAudioEnabled ? 'secondary' : 'destructive'}
              size="icon"
              onClick={toggleAudio}
              disabled={isProcessing}
            >
              {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>

      {/* Answer Timer */}
      {isRecording && (
        <AnswerTimer
          durationSeconds={120}
          isRunning={isRecording}
          onTimeUp={handleTimeUp}
        />
      )}

      {/* Recording Controls */}
      <div className="flex justify-center gap-3">
        {answerState === 'idle' && (
          <Button onClick={handleStart} className="gap-2">
            <Play className="h-4 w-4" />
            Start Answer
          </Button>
        )}

        {isRecording && (
          <>
            <Button variant="destructive" onClick={handleStop} className="gap-2">
              <Square className="h-4 w-4" />
              Stop (I'm done)
            </Button>
          </>
        )}

        {(answerState === 'scored' || answerState === 'processing') && (
          <Button variant="outline" onClick={handleReRecord} className="gap-2" disabled={isProcessing}>
            <RotateCcw className="h-4 w-4" />
            Re-record
          </Button>
        )}
      </div>

      {/* Processing State */}
      {isProcessing && (
        <div className="flex items-center justify-center gap-3 py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground">Processing your answer...</span>
        </div>
      )}
    </div>
  );
}
