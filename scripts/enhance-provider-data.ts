// scripts/enhance-provider-data.ts
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables from .env.local
config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

async function enhanceProviderData() {
  console.log('🔧 Enhancing provider data for UX demo...\n')

  try {
    // Get all current providers
    const { data: providers, error: providersError } = await supabase
      .from('providers')
      .select('*')

    if (providersError) {
      console.error('❌ Error fetching providers:', providersError)
      return
    }

    console.log(`📋 Found ${providers.length} providers to enhance`)

    // Enhanced provider data for demo
    const providerEnhancements = [
      {
        first_name: 'Travis',
        last_name: 'Norseth',
        enhancements: {
          title: 'MD, Psychiatrist',
          bio: 'Dr. Norseth specializes in adult psychiatry with a focus on anxiety, depression, and ADHD. He has 8 years of experience in both inpatient and outpatient settings.',
          languages_spoken: ['English', 'Norwegian'],
          specialty: 'Adult Psychiatry',
          provider_type: 'Psychiatrist',
          years_experience: 8,
          education: 'University of Utah School of Medicine',
          consultation_fee: 250,
          follow_up_fee: 150,
          image_url: '/providers/travis-norseth.jpg',
          accepts_new_patients: true,
          telehealth_enabled: true,
          appointment_types: ['Initial Consultation', 'Follow-up', 'Medication Management']
        }
      },
      {
        first_name: 'Tatiana',
        last_name: 'Kaehler',
        enhancements: {
          title: 'MD, Psychiatry Resident',
          bio: 'Dr. Kaehler is a psychiatry resident with special interests in mood disorders and trauma-informed care. She provides compassionate, evidence-based treatment.',
          languages_spoken: ['English', 'Spanish'],
          specialty: 'General Psychiatry',
          provider_type: 'Resident',
          years_experience: 2,
          education: 'University of Utah School of Medicine',
          consultation_fee: 180,
          follow_up_fee: 120,
          image_url: '/providers/tatiana-kaehler.jpg',
          accepts_new_patients: true,
          telehealth_enabled: true,
          appointment_types: ['Initial Consultation', 'Follow-up', 'Therapy']
        }
      },
      {
        first_name: 'Mitchell',
        last_name: 'Allen',
        enhancements: {
          title: 'PsyD, Clinical Psychologist',
          bio: 'Dr. Allen provides cognitive behavioral therapy and specializes in working with young adults facing life transitions and adjustment challenges.',
          languages_spoken: ['English'],
          specialty: 'Clinical Psychology',
          provider_type: 'Psychologist',
          years_experience: 5,
          education: 'Pacific University',
          consultation_fee: 200,
          follow_up_fee: 160,
          image_url: '/providers/mitchell-allen.jpg',
          accepts_new_patients: true,
          telehealth_enabled: true,
          appointment_types: ['Initial Consultation', 'Therapy', 'Psychological Assessment']
        }
      },
      {
        first_name: 'Gisele',
        last_name: 'Braga',
        enhancements: {
          title: 'LCSW, Licensed Clinical Social Worker',
          bio: 'Gisele specializes in trauma therapy, family counseling, and culturally responsive mental health care with bilingual Spanish-English services.',
          languages_spoken: ['English', 'Spanish', 'Portuguese'],
          specialty: 'Clinical Social Work',
          provider_type: 'Licensed Therapist',
          years_experience: 7,
          education: 'University of Utah College of Social Work',
          consultation_fee: 150,
          follow_up_fee: 120,
          image_url: '/providers/gisele-braga.jpg',
          accepts_new_patients: true,
          telehealth_enabled: true,
          appointment_types: ['Initial Consultation', 'Individual Therapy', 'Family Therapy']
        }
      },
      {
        first_name: 'C. Rufus',
        last_name: 'Sweeney',
        enhancements: {
          title: 'MD, Psychiatrist',
          bio: 'Dr. Sweeney has extensive experience in geriatric psychiatry and neurocognitive disorders. He focuses on comprehensive psychiatric care for older adults.',
          languages_spoken: ['English'],
          specialty: 'Geriatric Psychiatry',
          provider_type: 'Psychiatrist',
          years_experience: 15,
          education: 'Harvard Medical School',
          consultation_fee: 275,
          follow_up_fee: 175,
          image_url: '/providers/rufus-sweeney.jpg',
          accepts_new_patients: true,
          telehealth_enabled: false,
          appointment_types: ['Initial Consultation', 'Follow-up', 'Geriatric Assessment']
        }
      }
    ]

    // Update each provider with enhanced data
    for (const enhancement of providerEnhancements) {
      const provider = providers.find(p => 
        p.first_name === enhancement.first_name && 
        p.last_name === enhancement.last_name
      )

      if (provider) {
        console.log(`🔧 Enhancing ${provider.first_name} ${provider.last_name}...`)

        const { error: updateError } = await supabase
          .from('providers')
          .update({
            title: enhancement.enhancements.title,
            bio: enhancement.enhancements.bio,
            languages_spoken: enhancement.enhancements.languages_spoken,
            specialty: enhancement.enhancements.specialty,
            provider_type: enhancement.enhancements.provider_type,
            years_experience: enhancement.enhancements.years_experience,
            education: enhancement.enhancements.education,
            consultation_fee: enhancement.enhancements.consultation_fee,
            follow_up_fee: enhancement.enhancements.follow_up_fee,
            image_url: enhancement.enhancements.image_url,
            accepts_new_patients: enhancement.enhancements.accepts_new_patients,
            telehealth_enabled: enhancement.enhancements.telehealth_enabled,
            appointment_types: enhancement.enhancements.appointment_types,
            updated_at: new Date().toISOString()
          })
          .eq('id', provider.id)

        if (updateError) {
          console.error(`❌ Error updating ${provider.first_name} ${provider.last_name}:`, updateError)
        } else {
          console.log(`✅ Enhanced ${provider.first_name} ${provider.last_name}`)
        }
      } else {
        console.log(`⚠️ Provider ${enhancement.first_name} ${enhancement.last_name} not found`)
      }

      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log('\n🎉 Provider data enhancement complete!')

    // Verify the enhanced data
    const { data: enhancedProviders, error: verifyError } = await supabase
      .from('providers')
      .select('first_name, last_name, title, specialty, provider_type, languages_spoken')
      .not('title', 'is', null)

    if (verifyError) {
      console.error('❌ Error verifying enhanced data:', verifyError)
    } else {
      console.log('\n📊 Enhanced providers summary:')
      enhancedProviders.forEach((provider, i) => {
        console.log(`${i + 1}. ${provider.first_name} ${provider.last_name} - ${provider.title}`)
        console.log(`   Specialty: ${provider.specialty}`)
        console.log(`   Languages: ${Array.isArray(provider.languages_spoken) ? provider.languages_spoken.join(', ') : provider.languages_spoken}`)
        console.log('')
      })
    }

  } catch (error: any) {
    console.error('❌ Enhancement script failed:', error.message)
  }
}

enhanceProviderData()