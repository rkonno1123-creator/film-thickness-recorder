import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// 測定データの型
interface MeasurementData {
  id: string;
  pointId: string;
  pointName: string;
  category: string;
  operator: string;
  instrument: string;
  values: number[];
  average: number;
  timestamp: string;
}

// Firestoreに測定データを送信
export async function syncMeasurements(measurements: MeasurementData[]): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const measurementsRef = collection(db, 'measurements');
    let count = 0;

    for (const m of measurements) {
      await addDoc(measurementsRef, {
        ...m,
        uploadedAt: serverTimestamp(),
      });
      count++;
    }

    return { success: true, count };
  } catch (error) {
    console.error('Firestore sync error:', error);
    return { 
      success: false, 
      count: 0, 
      error: error instanceof Error ? error.message : '送信に失敗しました' 
    };
  }
}
