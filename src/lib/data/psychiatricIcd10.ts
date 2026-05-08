/**
 * Psychiatric ICD-10 codes used by Moonlit providers.
 *
 * Used for two purposes:
 *  1. Expand a bare code the provider types (e.g. "F33.1") into a human-
 *     readable label "Major depressive disorder, recurrent, moderate
 *     (ICD-10: F33.1)" so letters read clearly to non-clinicians.
 *  2. (Future) Power a typeahead suggestion list.
 *
 * Not exhaustive. If a code is missing, the provider can still free-text the
 * full diagnosis label and it will be used verbatim.
 */

export const PSYCHIATRIC_ICD10: Record<string, string> = {
  // Mood disorders
  'F32.0': 'Major depressive disorder, single episode, mild',
  'F32.1': 'Major depressive disorder, single episode, moderate',
  'F32.2': 'Major depressive disorder, single episode, severe without psychotic features',
  'F32.3': 'Major depressive disorder, single episode, severe with psychotic features',
  'F32.4': 'Major depressive disorder, single episode, in partial remission',
  'F32.5': 'Major depressive disorder, single episode, in full remission',
  'F32.9': 'Major depressive disorder, single episode, unspecified',
  'F32.A': 'Depression, unspecified',
  'F33.0': 'Major depressive disorder, recurrent, mild',
  'F33.1': 'Major depressive disorder, recurrent, moderate',
  'F33.2': 'Major depressive disorder, recurrent, severe without psychotic features',
  'F33.3': 'Major depressive disorder, recurrent, severe with psychotic features',
  'F33.40': 'Major depressive disorder, recurrent, in remission, unspecified',
  'F33.41': 'Major depressive disorder, recurrent, in partial remission',
  'F33.42': 'Major depressive disorder, recurrent, in full remission',
  'F33.9': 'Major depressive disorder, recurrent, unspecified',
  'F34.0': 'Cyclothymic disorder',
  'F34.1': 'Dysthymic disorder (persistent depressive disorder)',
  'F34.81': 'Disruptive mood dysregulation disorder',
  'F34.89': 'Other specified persistent mood disorder',
  'F34.9': 'Persistent mood disorder, unspecified',
  'F31.0': 'Bipolar disorder, current episode hypomanic',
  'F31.10': 'Bipolar disorder, current episode manic without psychotic features, unspecified',
  'F31.11': 'Bipolar disorder, current episode manic without psychotic features, mild',
  'F31.12': 'Bipolar disorder, current episode manic without psychotic features, moderate',
  'F31.13': 'Bipolar disorder, current episode manic without psychotic features, severe',
  'F31.2': 'Bipolar disorder, current episode manic with psychotic features',
  'F31.30': 'Bipolar disorder, current episode depressed, mild or moderate severity, unspecified',
  'F31.31': 'Bipolar disorder, current episode depressed, mild',
  'F31.32': 'Bipolar disorder, current episode depressed, moderate',
  'F31.4': 'Bipolar disorder, current episode depressed, severe without psychotic features',
  'F31.5': 'Bipolar disorder, current episode depressed, severe with psychotic features',
  'F31.60': 'Bipolar disorder, current episode mixed, unspecified',
  'F31.61': 'Bipolar disorder, current episode mixed, mild',
  'F31.62': 'Bipolar disorder, current episode mixed, moderate',
  'F31.63': 'Bipolar disorder, current episode mixed, severe without psychotic features',
  'F31.64': 'Bipolar disorder, current episode mixed, severe with psychotic features',
  'F31.70': 'Bipolar disorder, in remission, most recent episode unspecified',
  'F31.71': 'Bipolar disorder, in partial remission, most recent episode hypomanic',
  'F31.72': 'Bipolar disorder, in full remission, most recent episode hypomanic',
  'F31.73': 'Bipolar disorder, in partial remission, most recent episode manic',
  'F31.74': 'Bipolar disorder, in full remission, most recent episode manic',
  'F31.75': 'Bipolar disorder, in partial remission, most recent episode depressed',
  'F31.76': 'Bipolar disorder, in full remission, most recent episode depressed',
  'F31.77': 'Bipolar disorder, in partial remission, most recent episode mixed',
  'F31.78': 'Bipolar disorder, in full remission, most recent episode mixed',
  'F31.81': 'Bipolar II disorder',
  'F31.89': 'Other bipolar disorder',
  'F31.9': 'Bipolar disorder, unspecified',

  // Anxiety, OCD, trauma, stress-related
  'F40.00': 'Agoraphobia, unspecified',
  'F40.01': 'Agoraphobia with panic disorder',
  'F40.10': 'Social anxiety disorder, unspecified',
  'F40.11': 'Social anxiety disorder, generalized',
  'F40.9': 'Phobic anxiety disorder, unspecified',
  'F41.0': 'Panic disorder',
  'F41.1': 'Generalized anxiety disorder',
  'F41.3': 'Other mixed anxiety disorders',
  'F41.8': 'Other specified anxiety disorders',
  'F41.9': 'Anxiety disorder, unspecified',
  'F42.2': 'Mixed obsessional thoughts and acts',
  'F42.3': 'Hoarding disorder',
  'F42.8': 'Other obsessive-compulsive disorder',
  'F42.9': 'Obsessive-compulsive disorder, unspecified',
  'F43.0': 'Acute stress reaction',
  'F43.10': 'Post-traumatic stress disorder, unspecified',
  'F43.11': 'Post-traumatic stress disorder, acute',
  'F43.12': 'Post-traumatic stress disorder, chronic',
  'F43.20': 'Adjustment disorder, unspecified',
  'F43.21': 'Adjustment disorder with depressed mood',
  'F43.22': 'Adjustment disorder with anxiety',
  'F43.23': 'Adjustment disorder with mixed anxiety and depressed mood',
  'F43.24': 'Adjustment disorder with disturbance of conduct',
  'F43.25': 'Adjustment disorder with mixed disturbance of emotions and conduct',
  'F43.29': 'Adjustment disorder with other symptoms',
  'F43.8': 'Other reactions to severe stress',
  'F43.9': 'Reaction to severe stress, unspecified',

  // ADHD, neurodevelopmental
  'F90.0': 'Attention-deficit/hyperactivity disorder, predominantly inattentive type',
  'F90.1': 'Attention-deficit/hyperactivity disorder, predominantly hyperactive-impulsive type',
  'F90.2': 'Attention-deficit/hyperactivity disorder, combined type',
  'F90.8': 'Attention-deficit/hyperactivity disorder, other type',
  'F90.9': 'Attention-deficit/hyperactivity disorder, unspecified type',
  'F84.0': 'Autistic disorder',
  'F84.5': 'Asperger syndrome',
  'F84.9': 'Pervasive developmental disorder, unspecified',

  // Schizophrenia spectrum
  'F20.0': 'Paranoid schizophrenia',
  'F20.1': 'Disorganized schizophrenia',
  'F20.2': 'Catatonic schizophrenia',
  'F20.3': 'Undifferentiated schizophrenia',
  'F20.5': 'Residual schizophrenia',
  'F20.81': 'Schizophreniform disorder',
  'F20.89': 'Other schizophrenia',
  'F20.9': 'Schizophrenia, unspecified',
  'F21': 'Schizotypal disorder',
  'F22': 'Delusional disorders',
  'F23': 'Brief psychotic disorder',
  'F25.0': 'Schizoaffective disorder, bipolar type',
  'F25.1': 'Schizoaffective disorder, depressive type',
  'F25.8': 'Other schizoaffective disorders',
  'F25.9': 'Schizoaffective disorder, unspecified',
  'F29': 'Unspecified psychosis not due to a substance or known physiological condition',

  // Substance use (most common; non-exhaustive)
  'F10.10': 'Alcohol abuse, uncomplicated',
  'F10.20': 'Alcohol dependence, uncomplicated',
  'F11.20': 'Opioid dependence, uncomplicated',
  'F12.10': 'Cannabis abuse, uncomplicated',
  'F12.20': 'Cannabis dependence, uncomplicated',
  'F14.20': 'Cocaine dependence, uncomplicated',
  'F15.20': 'Other stimulant dependence, uncomplicated',
  'F17.200': 'Nicotine dependence, unspecified, uncomplicated',
  'F17.210': 'Nicotine dependence, cigarettes, uncomplicated',
  'F19.20': 'Other psychoactive substance dependence, uncomplicated',

  // Eating disorders
  'F50.00': 'Anorexia nervosa, unspecified',
  'F50.01': 'Anorexia nervosa, restricting type',
  'F50.02': 'Anorexia nervosa, binge eating/purging type',
  'F50.2': 'Bulimia nervosa',
  'F50.81': 'Binge eating disorder',
  'F50.82': 'Avoidant/restrictive food intake disorder',
  'F50.89': 'Other specified eating disorder',
  'F50.9': 'Eating disorder, unspecified',

  // Sleep
  'G47.00': 'Insomnia, unspecified',
  'G47.01': 'Insomnia due to medical condition',
  'G47.09': 'Other insomnia',

  // Personality
  'F60.0': 'Paranoid personality disorder',
  'F60.1': 'Schizoid personality disorder',
  'F60.2': 'Antisocial personality disorder',
  'F60.3': 'Borderline personality disorder',
  'F60.4': 'Histrionic personality disorder',
  'F60.5': 'Obsessive-compulsive personality disorder',
  'F60.6': 'Avoidant personality disorder',
  'F60.7': 'Dependent personality disorder',
  'F60.81': 'Narcissistic personality disorder',
  'F60.89': 'Other specified personality disorder',
  'F60.9': 'Personality disorder, unspecified',
}

const CODE_REGEX = /^[A-Z]\d{1,2}(\.[A-Z0-9]{1,3})?$/i

/**
 * Format whatever the provider typed into a clean, reader-friendly string.
 *
 *   "f33.1"                                       → "Major depressive disorder, recurrent, moderate (ICD-10: F33.1)"
 *   "F33.1"                                       → "Major depressive disorder, recurrent, moderate (ICD-10: F33.1)"
 *   "F99.99"                                      → "F99.99"  (unknown code, returned uppercased)
 *   "F33.1 Major depressive disorder"             → "Major depressive disorder (ICD-10: F33.1)"
 *   "Major depressive disorder, recurrent, mod."  → "Major depressive disorder, recurrent, mod."  (no code → unchanged)
 */
export function formatDiagnosis(input: string): string {
  const raw = (input || '').trim()
  if (!raw) return raw

  // Tokenize on whitespace; first token might be a code.
  const firstSpace = raw.search(/\s/)
  const head = firstSpace === -1 ? raw : raw.slice(0, firstSpace)
  const tail = firstSpace === -1 ? '' : raw.slice(firstSpace + 1).trim()

  const headLooksLikeCode = CODE_REGEX.test(head)

  if (headLooksLikeCode) {
    const code = head.toUpperCase()
    const dictDescription = PSYCHIATRIC_ICD10[code]
    const description = tail || dictDescription
    if (description) {
      return `${description} (ICD-10: ${code})`
    }
    // Unknown code with no description: return the code uppercased only.
    return code
  }

  // No leading code — assume the provider wrote a full description in plain English.
  return raw
}
