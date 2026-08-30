// Operator-authored verified cases for /verified.
// Each case is a checkable physical fact with real public citations.
// These are NOT customer work orders or fabricated MECHA receipts.

export const VERIFIED_CASES = [
  {
    id: "sky-blue",
    question: "Is the sky really blue?",
    summary:
      "Rayleigh scattering makes the sky blue, not violet, because human eyes are more sensitive to blue and sunlight has less violet to begin with.",
    form: {
      goal: "Confirm that Earth's daytime sky appears blue due to Rayleigh scattering and explain why it is not violet",
      acs: [
        {
          text: "Cite a peer-reviewed or authoritative physics source defining Rayleigh scattering",
          kind: "AUTO",
        },
        {
          text: "Explain why shorter wavelengths scatter more than longer ones",
          kind: "AUTO",
        },
        {
          text: "State why the sky appears blue rather than violet despite violet being shorter wavelength",
          kind: "AUTO",
        },
      ],
      nonGoals: "No discussion of sunsets, no atmospheric pollution effects, no other planets",
      maxIterations: 30,
      preauthorized: "",
    },
    evidence: {
      label: "Operator case file",
      notes: [
        "Rayleigh scattering intensity is proportional to 1/wavelength^4, favoring shorter wavelengths.",
        "Violet light (380-450nm) scatters more than blue (450-495nm), but the Sun emits less violet and human cone cells are less sensitive to violet than blue.",
        "The combined effect produces a blue sky, not a violet one.",
      ],
      citations: [
        {
          text: "NASA Science: Why is the sky blue?",
          url: "https://science.nasa.gov/blue-skies",
        },
        {
          text: "HyperPhysics: Rayleigh Scattering (Georgia State University)",
          url: "http://hyperphysics.phy-astr.gsu.edu/hbase/atmos/blusky.html",
        },
      ],
    },
  },
  {
    id: "ice-floats",
    question: "Does ice float on water?",
    summary:
      "Ice floats because solid water is less dense than liquid water, an anomaly caused by hydrogen bonding in the crystal lattice.",
    form: {
      goal: "Verify that ice floats on liquid water and explain the density anomaly",
      acs: [
        {
          text: "State the density of ice vs liquid water at 0C",
          kind: "AUTO",
        },
        {
          text: "Cite a physics or chemistry source for the hydrogen bond explanation",
          kind: "AUTO",
        },
        {
          text: "Confirm buoyancy: an object less dense than the fluid floats",
          kind: "AUTO",
        },
      ],
      nonGoals: "No discussion of other substances, no climate implications, no saltwater specifics",
      maxIterations: 30,
      preauthorized: "",
    },
    evidence: {
      label: "Operator case file",
      notes: [
        "Ice density: ~0.917 g/cm3. Liquid water at 0C: ~0.9998 g/cm3.",
        "Hydrogen bonds in ice form a hexagonal lattice that spaces molecules farther apart than in liquid water.",
        "Because ice is less dense, it displaces more than its weight in water and floats.",
      ],
      citations: [
        {
          text: "USGS Water Science School: Water Density",
          url: "https://www.usgs.gov/special-topics/water-science-school/science/water-density",
        },
        {
          text: "HyperPhysics: Density of Water and Ice",
          url: "http://hyperphysics.phy-astr.gsu.edu/hbase/Chemical/waterdens.html",
        },
      ],
    },
  },
  {
    id: "sound-space",
    question: "Can sound travel through outer space?",
    summary:
      "No. Sound is a mechanical wave that requires a medium. The near-vacuum of space has too few particles to transmit sound.",
    form: {
      goal: "Confirm that sound cannot travel through the vacuum of outer space",
      acs: [
        {
          text: "Define sound as a mechanical wave requiring a medium",
          kind: "AUTO",
        },
        {
          text: "State the particle density in interstellar space vs Earth atmosphere",
          kind: "AUTO",
        },
        {
          text: "Cite an authoritative space science source confirming no sound in vacuum",
          kind: "AUTO",
        },
      ],
      nonGoals: "No discussion of radio waves, no sci-fi movie effects, no plasma oscillations",
      maxIterations: 30,
      preauthorized: "",
    },
    evidence: {
      label: "Operator case file",
      notes: [
        "Sound is a longitudinal pressure wave that propagates by particle collisions in a medium.",
        "Interstellar space: ~1 atom per cm3. Earth sea level: ~2.5 x 10^19 molecules per cm3.",
        "Without sufficient particle density, pressure waves cannot form or propagate.",
      ],
      citations: [
        {
          text: "NASA: Sound in Space (Ask an Astronomer)",
          url: "https://science.nasa.gov/learn/basics-of-space-flight/chapter5-2/",
        },
        {
          text: "Physics Classroom: Sound Waves and the Medium",
          url: "https://www.physicsclassroom.com/class/sound/Lesson-1/Sound-is-a-Mechanical-Wave",
        },
      ],
    },
  },
  {
    id: "lunar-tides",
    question: "Do lunar tides exist because of the Moon's gravity?",
    summary:
      "Yes. The Moon's gravitational pull creates tidal bulges on Earth. The Sun also contributes, but the Moon dominates due to proximity.",
    form: {
      goal: "Confirm that lunar tides on Earth are caused by the Moon's gravitational pull",
      acs: [
        {
          text: "Cite a tidal science source attributing ocean tides to gravitational attraction",
          kind: "AUTO",
        },
        {
          text: "Explain why the Moon's effect exceeds the Sun's despite the Sun's greater mass",
          kind: "AUTO",
        },
        {
          text: "State the approximate tidal range attributable to the Moon vs the Sun",
          kind: "AUTO",
        },
      ],
      nonGoals: "No discussion of tidal energy, no estuarine effects, no tidal locking",
      maxIterations: 30,
      preauthorized: "",
    },
    evidence: {
      label: "Operator case file",
      notes: [
        "Tidal force scales with mass/distance^3, so the closer Moon exerts ~2.2x more tidal force than the Sun.",
        "The Moon causes the primary tidal bulge; the Sun modulates it (spring/neap tides).",
        "Typical lunar tidal range: ~0.5m open ocean; solar component adds or subtracts ~0.2m.",
      ],
      citations: [
        {
          text: "NOAA: What Causes Tides?",
          url: "https://oceanservice.noaa.gov/education/tutorial_tides/tides02_cause.html",
        },
        {
          text: "NASA Moon Facts: Tides",
          url: "https://moon.nasa.gov/inside-and-out/tides/",
        },
      ],
    },
  },
];
