import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRoute } from '@react-navigation/native';

export default function QuizScreen() {
  const route = useRoute<any>();
  const { quizId } = route.params;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Quiz</Text>
        <Text style={styles.subtitle}>Quiz {quizId}</Text>
      </View>

      <View style={styles.questionCard}>
        <Text style={styles.questionNumber}>Question 1 of 10</Text>
        <Text style={styles.questionText}>What is the capital of France?</Text>

        <View style={styles.options}>
          {['Paris', 'London', 'Berlin', 'Madrid'].map((option, idx) => (
            <TouchableOpacity key={idx} style={styles.optionButton}>
              <Text style={styles.optionText}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.submitButton}>
        <Text style={styles.submitText}>Submit Answer</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    padding: 16,
  },
  header: {
    marginBottom: 24,
    marginTop: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  questionCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  questionNumber: {
    fontSize: 12,
    color: '#888',
    marginBottom: 12,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 20,
  },
  options: {
    gap: 12,
  },
  optionButton: {
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#333',
  },
  optionText: {
    fontSize: 14,
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#00ff88',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },
});
