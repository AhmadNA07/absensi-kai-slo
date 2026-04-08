// ==================== FACE RECOGNITION CONFIG ====================
// Model URL - load dari GitHub raw (paling mudah)
const FACE_MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';

// Threshold untuk face matching (0.6 = cukup ketat, semakin kecil semakin ketat)
const FACE_MATCH_THRESHOLD = 0.6;

let faceModelsLoaded = false;

// Load semua model face-api
async function loadFaceModels() {
    if (faceModelsLoaded) return true;
    
    try {
        console.log('🔄 Loading face models...');
        
        // Load model dari CDN GitHub
        await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URL);
        
        faceModelsLoaded = true;
        console.log('✅ Face models loaded successfully');
        return true;
    } catch (error) {
        console.error('❌ Error loading face models:', error);
        return false;
    }
}

// Start camera
async function startCamera(videoElement) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user" } 
        });
        videoElement.srcObject = stream;
        return true;
    } catch (error) {
        console.error('Camera error:', error);
        return false;
    }
}

// Stop camera
function stopCamera(videoElement) {
    if (videoElement && videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
    }
}

// Ambil face descriptor dari video
async function getFaceDescriptor(videoElement) {
    const detection = await faceapi
        .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();
    
    if (!detection) return null;
    return detection.descriptor;
}

// Simpan face descriptor ke database
async function saveFaceDescriptor(siswaId, descriptor) {
    const { error } = await supabaseClient
        .from('siswa')
        .update({ 
            face_descriptor: Array.from(descriptor),
            has_face: true
        })
        .eq('id', siswaId);
    
    if (error) throw error;
    return true;
}

// Hapus face descriptor
async function deleteFaceDescriptor(siswaId) {
    const { error } = await supabaseClient
        .from('siswa')
        .update({ 
            face_descriptor: null,
            has_face: false
        })
        .eq('id', siswaId);
    
    if (error) throw error;
    return true;
}

// Cek apakah wajah cocok dengan database
async function matchFace(descriptor) {
    // Ambil semua siswa yang sudah punya face_descriptor
    const { data: siswa, error } = await supabaseClient
        .from('siswa')
        .select('id, nama, nis, face_descriptor')
        .eq('has_face', true)
        .eq('status', 'aktif');
    
    if (error || !siswa || siswa.length === 0) return null;
    
    let bestMatch = null;
    let minDistance = FACE_MATCH_THRESHOLD;
    
    for (const s of siswa) {
        if (!s.face_descriptor) continue;
        
        const dbDescriptor = new Float32Array(Object.values(s.face_descriptor));
        const distance = faceapi.euclideanDistance(descriptor, dbDescriptor);
        
        if (distance < minDistance) {
            minDistance = distance;
            bestMatch = s;
        }
    }
    
    return bestMatch;
}