document.addEventListener('DOMContentLoaded', () => {
    const audioFileInput = document.getElementById('audioFile');
    const speedInput = document.getElementById('speed');
    const processButton = document.getElementById('processButton');
    const downloadButton = document.getElementById('downloadButton');
    const waveform = document.getElementById('waveform');
    
    let wavesurfer;
    let originalBuffer;

    audioFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();

                audioContext.decodeAudioData(e.target.result, (buffer) => {
                    originalBuffer = buffer;
                    downloadButton.disabled = true;

                    // Initialize WaveSurfer with the decoded buffer
                    if (wavesurfer) {
                        wavesurfer.destroy();
                    }
                    wavesurfer = WaveSurfer.create({
                        container: waveform,
                        waveColor: 'violet',
                        progressColor: 'purple',
                        backend: 'WebAudio'  // Ensure WaveSurfer uses Web Audio API
                    });

                    // Here we load the audio buffer into WaveSurfer
                    // wavesurfer.loadDecodedBuffer(buffer);
                    wavesurfer.load(buffer);
                    

                }, (error) => {
                    console.error('Error decoding audio data:', error);
                });
            };

            reader.onerror = (error) => {
                console.error('FileReader error:', error);
            };

            reader.readAsArrayBuffer(file);
        }
    });

    processButton.addEventListener('click', () => {
        const speed = parseFloat(speedInput.value);
        if (originalBuffer) {
            const offlineContext = new OfflineAudioContext(
                originalBuffer.numberOfChannels,
                originalBuffer.length / speed,
                originalBuffer.sampleRate
            );

            const source = offlineContext.createBufferSource();
            source.buffer = originalBuffer;
            source.playbackRate.setValueAtTime(speed, 0);

            source.connect(offlineContext.destination);
            source.start(0);

            offlineContext.startRendering().then((renderedBuffer) => {
                // Load the new speed-adjusted buffer into WaveSurfer
                wavesurfer.loadDecodedBuffer(renderedBuffer);
                downloadButton.disabled = false;
            }).catch((err) => {
                console.error('Error in audio processing:', err);
            });
        } else {
            console.error('No audio buffer to process');
        }
    });

    downloadButton.addEventListener('click', () => {
        if (wavesurfer) {
            const buffer = wavesurfer.backend.buffer;
            const wavData = audioBufferToWav(buffer);
            const blob = new Blob([new DataView(wavData)], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'processed_audio.wav';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            downloadButton.disabled = true;
        }
    });

    function audioBufferToWav(buffer) {
        const numOfChan = buffer.numberOfChannels,
            length = buffer.length * numOfChan * 2 + 44,
            bufferArray = new ArrayBuffer(length),
            view = new DataView(bufferArray),
            channels = [], i=null, sample=null,
            offset = 0,
            pos = 0;

        // write WAV header
        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8); // file length - 8
        setUint32(0x45564157); // "WAVE"

        setUint32(0x20746d66); // "fmt " chunk
        setUint32(16); // length = 16
        setUint16(1); // PCM (uncompressed)
        setUint16(numOfChan);
        setUint32(buffer.sampleRate);
        setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
        setUint16(numOfChan * 2); // block-align
        setUint16(16); // 16-bit (hardcoded in this demo)

        setUint32(0x61746164); // "data" - chunk
        setUint32(length - pos - 4); // chunk length

        // write interleaved data
        for (i = 0; i < buffer.numberOfChannels; i++)
            channels.push(buffer.getChannelData(i));

        while (pos < length) {
            for (i = 0; i < numOfChan; i++) { // interleave channels
                sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
                view.setInt16(pos, sample, true); // write 16-bit sample
                pos += 2;
            }
            offset++ // next source sample
        }

        return bufferArray;

        function setUint16(data) {
            view.setUint16(pos, data, true);
            pos += 2;
        }

        function setUint32(data) {
            view.setUint32(pos, data, true);
            pos += 4;
        }
    }
});