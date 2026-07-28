import { Asset } from 'expo-asset';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'jpeg-js';
import { InferenceSession, Tensor } from 'onnxruntime-react-native';

import faceModelAsset from '../../../assets/models/facenet.onnx';

const FACE_MODEL_INPUT_SIZE = 160;
const FACE_RECOGNITION_THRESHOLD = 0.5;

let sessionPromise: Promise<InferenceSession> | null = null;

export type FaceEmbedding = number[];

export type FaceRecognitionMatch = {
  isMatch: boolean;
  similarity: number;
  threshold: number;
};

async function getFaceRecognitionSession() {
  if (!sessionPromise) {
    sessionPromise = Asset.fromModule(faceModelAsset)
      .downloadAsync()
      .then((asset) => {
        const modelUri = asset.localUri ?? asset.uri;
        return InferenceSession.create(modelUri);
      });
  }

  return sessionPromise;
}

export async function generateFaceEmbeddingFromImage(imageUri: string) {
  const tensorData = await imageUriToFaceNetTensor(imageUri);
  const session = await getFaceRecognitionSession();
  const inputName = session.inputNames[0] ?? 'input';
  const outputName = session.outputNames[0] ?? 'embedding';
  const feeds: Record<string, Tensor> = {
    [inputName]: new Tensor('float32', tensorData, [1, 3, FACE_MODEL_INPUT_SIZE, FACE_MODEL_INPUT_SIZE]),
  };
  const results = await session.run(feeds);
  const output = results[outputName] ?? results[session.outputNames[0]];

  if (!output || !(output.data instanceof Float32Array)) {
    throw new Error('Face embedding model returned an invalid output.');
  }

  return normalizeEmbedding(Array.from(output.data));
}

export function averageFaceEmbeddings(embeddings: FaceEmbedding[]) {
  if (embeddings.length === 0) {
    throw new Error('No face embeddings were captured.');
  }

  const size = embeddings[0].length;
  const average = Array.from({ length: size }, (_, index) => {
    const total = embeddings.reduce((sum, embedding) => sum + embedding[index], 0);
    return total / embeddings.length;
  });

  return normalizeEmbedding(average);
}

export function compareFaceEmbeddings(
  enrolledEmbedding: FaceEmbedding,
  liveEmbedding: FaceEmbedding
): FaceRecognitionMatch {
  const similarity = cosineSimilarity(enrolledEmbedding, liveEmbedding);

  return {
    isMatch: similarity >= FACE_RECOGNITION_THRESHOLD,
    similarity,
    threshold: FACE_RECOGNITION_THRESHOLD,
  };
}

export function summarizeFaceEmbedding(embedding: FaceEmbedding) {
  if (embedding.length === 0) {
    return {
      length: 0,
      max: 0,
      mean: 0,
      min: 0,
      norm: 0,
    };
  }

  const total = embedding.reduce((sum, value) => sum + value, 0);
  const squaredTotal = embedding.reduce((sum, value) => sum + value * value, 0);

  return {
    length: embedding.length,
    max: Number(Math.max(...embedding).toFixed(6)),
    mean: Number((total / embedding.length).toFixed(6)),
    min: Number(Math.min(...embedding).toFixed(6)),
    norm: Number(Math.sqrt(squaredTotal).toFixed(6)),
  };
}

async function imageUriToFaceNetTensor(imageUri: string) {
  const image = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: FACE_MODEL_INPUT_SIZE, height: FACE_MODEL_INPUT_SIZE } }],
    {
      base64: true,
      compress: 1,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  if (!image.base64) {
    throw new Error('Could not read face image data.');
  }

  const jpeg = decode(base64ToUint8Array(image.base64), { useTArray: true });
  const rgba = jpeg.data;
  const pixels = FACE_MODEL_INPUT_SIZE * FACE_MODEL_INPUT_SIZE;
  const tensor = new Float32Array(3 * pixels);

  for (let index = 0; index < pixels; index += 1) {
    const rgbaIndex = index * 4;
    tensor[index] = rgba[rgbaIndex] / 127.5 - 1;
    tensor[pixels + index] = rgba[rgbaIndex + 1] / 127.5 - 1;
    tensor[pixels * 2 + index] = rgba[rgbaIndex + 2] / 127.5 - 1;
  }

  return tensor;
}

function base64ToUint8Array(value: string) {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function normalizeEmbedding(embedding: FaceEmbedding) {
  const magnitude = Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0));

  if (magnitude === 0) {
    return embedding;
  }

  return embedding.map((value) => value / magnitude);
}

function cosineSimilarity(left: FaceEmbedding, right: FaceEmbedding) {
  const size = Math.min(left.length, right.length);

  if (size === 0) {
    return 0;
  }

  let dot = 0;
  for (let index = 0; index < size; index += 1) {
    dot += left[index] * right[index];
  }

  return dot;
}
