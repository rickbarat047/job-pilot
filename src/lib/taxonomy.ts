import { CandidateProfile, CandidatePreferences } from "@/lib/types";

export interface SkillDefinition {
  name: string;
  category: string;
  aliases: string[];
}

export const DEGREE_SKILLS: Record<string, string[]> = {
  // Engineering - Core
  "bachelor of technology": ["Problem Solving", "Teamwork", "Communication", "Excel", "Project Management", "Python", "Java", "SQL", "Data Analysis", "Git", "REST APIs"],
  "bachelor of engineering": ["Problem Solving", "Teamwork", "Communication", "Excel", "Project Management", "Python", "Java", "SQL", "Data Analysis", "Git", "REST APIs"],
  "b.tech": ["Problem Solving", "Teamwork", "Communication", "Excel", "Project Management", "Python", "Java", "SQL", "Data Analysis", "Git", "REST APIs"],
  "b.e": ["Problem Solving", "Teamwork", "Communication", "Excel", "Project Management", "Python", "Java", "SQL", "Data Analysis", "Git", "REST APIs"],
  "mechanical engineering": ["CAD", "SolidWorks", "AutoCAD", "CATIA", "Creo", "NX", "GD&T", "FEA", "CFD", "Manufacturing", "Production Planning", "Quality Control", "Maintenance", "ANSYS", "MATLAB", "Problem Solving", "Project Management"],
  "computer science": ["Python", "Java", "JavaScript", "TypeScript", "React", "Node.js", "SQL", "MongoDB", "Git", "REST APIs", "AWS", "Docker", "Data Analysis", "Machine Learning", "Problem Solving", "HTML", "CSS"],
  "computer science engineering": ["Python", "Java", "JavaScript", "TypeScript", "React", "Node.js", "SQL", "MongoDB", "Git", "REST APIs", "AWS", "Docker", "Data Analysis", "Machine Learning", "Problem Solving", "HTML", "CSS"],
  "information technology": ["Python", "Java", "JavaScript", "SQL", "Git", "REST APIs", "Networking", "Technical Support", "System Administration", "Linux", "AWS", "Docker", "Cybersecurity", "Problem Solving"],
  "electronics": ["Embedded Systems", "Circuit Design", "Arduino", "Raspberry Pi", "IoT", "PLC", "SCADA", "PCB Design", "Soldering", "Multimeter", "Oscilloscope", "Problem Solving"],
  "electronics and communication": ["Embedded Systems", "Circuit Design", "Arduino", "Raspberry Pi", "IoT", "PLC", "SCADA", "Networking", "5G", "Signal Processing", "Problem Solving"],
  "electrical": ["PLC", "SCADA", "Power Systems", "Electrical Design", "Maintenance", "AutoCAD Electrical", "ETAP", "MATLAB", "Problem Solving", "Project Management"],
  "civil engineering": ["AutoCAD", "STAAD", "Revit", "Construction Management", "Project Management", "Quality Control", "Site Supervision", "Quantity Surveying", "Structural Analysis", "Problem Solving"],
  "bachelor of civil engineering": ["AutoCAD", "STAAD", "Revit", "Construction Management", "Project Management", "Quality Control", "Site Supervision", "Quantity Surveying", "Structural Analysis", "Problem Solving"],
  "b.tech civil": ["AutoCAD", "STAAD", "Revit", "Construction Management", "Project Management", "Quality Control", "Site Supervision", "Quantity Surveying", "Structural Analysis", "Problem Solving"],
  "electrical engineering": ["PLC", "SCADA", "Power Systems", "Electrical Design", "Maintenance", "AutoCAD Electrical", "ETAP", "MATLAB", "Problem Solving", "Project Management"],
  "bachelor of electrical engineering": ["PLC", "SCADA", "Power Systems", "Electrical Design", "Maintenance", "AutoCAD Electrical", "ETAP", "MATLAB", "Problem Solving", "Project Management"],
  "b.tech electrical": ["PLC", "SCADA", "Power Systems", "Electrical Design", "Maintenance", "AutoCAD Electrical", "ETAP", "MATLAB", "Problem Solving", "Project Management"],
  "electronics engineering": ["Embedded Systems", "Circuit Design", "Arduino", "Raspberry Pi", "IoT", "PLC", "SCADA", "PCB Design", "VLSI", "Signal Processing", "Problem Solving"],
  "bachelor of electronics engineering": ["Embedded Systems", "Circuit Design", "Arduino", "Raspberry Pi", "IoT", "PLC", "SCADA", "PCB Design", "VLSI", "Signal Processing", "Problem Solving"],
  "b.tech electronics": ["Embedded Systems", "Circuit Design", "Arduino", "Raspberry Pi", "IoT", "PLC", "SCADA", "PCB Design", "VLSI", "Signal Processing", "Problem Solving"],
  "electronics and communication engineering": ["Embedded Systems", "Circuit Design", "Arduino", "Raspberry Pi", "IoT", "PLC", "SCADA", "Networking", "5G", "Signal Processing", "VLSI", "Communication Systems", "Problem Solving"],
  "bachelor of electronics and communication engineering": ["Embedded Systems", "Circuit Design", "Arduino", "Raspberry Pi", "IoT", "PLC", "SCADA", "Networking", "5G", "Signal Processing", "VLSI", "Communication Systems", "Problem Solving"],
  "b.tech ece": ["Embedded Systems", "Circuit Design", "Arduino", "Raspberry Pi", "IoT", "PLC", "SCADA", "Networking", "5G", "Signal Processing", "VLSI", "Communication Systems", "Problem Solving"],
  "ece": ["Embedded Systems", "Circuit Design", "Arduino", "Raspberry Pi", "IoT", "PLC", "SCADA", "Networking", "5G", "Signal Processing", "VLSI", "Communication Systems", "Problem Solving"],
  "chemical engineering": ["Chemical Process Design", "Process Simulation", "Aspen HYSYS", "Chemical Engineering", "Plant Design", "Safety Engineering", "Quality Control", "Problem Solving", "Project Management"],
  "bachelor of chemical engineering": ["Chemical Process Design", "Process Simulation", "Aspen HYSYS", "Chemical Engineering", "Plant Design", "Safety Engineering", "Quality Control", "Problem Solving", "Project Management"],
  "b.tech chemical": ["Chemical Process Design", "Process Simulation", "Aspen HYSYS", "Chemical Engineering", "Plant Design", "Safety Engineering", "Quality Control", "Problem Solving", "Project Management"],
  "aeronautical engineering": ["Aerodynamics", "Aircraft Design", "CATIA", "NX", "ANSYS", "CFD", "FEA", "Flight Mechanics", "Propulsion", "Problem Solving", "Project Management"],
  "bachelor of aeronautical engineering": ["Aerodynamics", "Aircraft Design", "CATIA", "NX", "ANSYS", "CFD", "FEA", "Flight Mechanics", "Propulsion", "Problem Solving", "Project Management"],
  "b.tech aeronautical": ["Aerodynamics", "Aircraft Design", "CATIA", "NX", "ANSYS", "CFD", "FEA", "Flight Mechanics", "Propulsion", "Problem Solving", "Project Management"],
  "aerospace engineering": ["Aerodynamics", "Aircraft Design", "CATIA", "NX", "ANSYS", "CFD", "FEA", "Flight Mechanics", "Propulsion", "Orbital Mechanics", "Problem Solving", "Project Management"],
  "bachelor of aerospace engineering": ["Aerodynamics", "Aircraft Design", "CATIA", "NX", "ANSYS", "CFD", "FEA", "Flight Mechanics", "Propulsion", "Orbital Mechanics", "Problem Solving", "Project Management"],
  "b.tech aerospace": ["Aerodynamics", "Aircraft Design", "CATIA", "NX", "ANSYS", "CFD", "FEA", "Flight Mechanics", "Propulsion", "Orbital Mechanics", "Problem Solving", "Project Management"],
  "marine engineering": ["Marine Engineering", "Naval Architecture", "Ship Design", "Marine Propulsion", "Maintenance", "Welding", "Problem Solving", "Project Management"],
  "bachelor of marine engineering": ["Marine Engineering", "Naval Architecture", "Ship Design", "Marine Propulsion", "Maintenance", "Welding", "Problem Solving", "Project Management"],
  "b.tech marine": ["Marine Engineering", "Naval Architecture", "Ship Design", "Marine Propulsion", "Maintenance", "Welding", "Problem Solving", "Project Management"],
  "mining engineering": ["Mining Engineering", "Mine Planning", "Blasting", "Ventilation", "Geology", "Mining Software", "Safety", "Problem Solving", "Project Management"],
  "bachelor of mining engineering": ["Mining Engineering", "Mine Planning", "Blasting", "Ventilation", "Geology", "Mining Software", "Safety", "Problem Solving", "Project Management"],
  "b.tech mining": ["Mining Engineering", "Mine Planning", "Blasting", "Ventilation", "Geology", "Mining Software", "Safety", "Problem Solving", "Project Management"],
  "petroleum engineering": ["Petroleum Engineering", "Reservoir Engineering", "Drilling", "Petrel", "Eclipse", "Production Engineering", "Problem Solving", "Project Management"],
  "bachelor of petroleum engineering": ["Petroleum Engineering", "Reservoir Engineering", "Drilling", "Petrel", "Eclipse", "Production Engineering", "Problem Solving", "Project Management"],
  "b.tech petroleum": ["Petroleum Engineering", "Reservoir Engineering", "Drilling", "Petrel", "Eclipse", "Production Engineering", "Problem Solving", "Project Management"],
  "textile engineering": ["Textile Engineering", "Spinning", "Weaving", "Dyeing", "Printing", "Garment Manufacturing", "Quality Control", "Problem Solving"],
  "bachelor of textile engineering": ["Textile Engineering", "Spinning", "Weaving", "Dyeing", "Printing", "Garment Manufacturing", "Quality Control", "Problem Solving"],
  "b.tech textile": ["Textile Engineering", "Spinning", "Weaving", "Dyeing", "Printing", "Garment Manufacturing", "Quality Control", "Problem Solving"],
  "biotechnology": ["Biotechnology", "Molecular Biology", "PCR", "Gel Electrophoresis", "Cell Culture", "ELISA", "Chromatography", "Biochemistry", "Problem Solving", "Lab Techniques"],
  "bachelor of biotechnology": ["Biotechnology", "Molecular Biology", "PCR", "Gel Electrophoresis", "Cell Culture", "ELISA", "Chromatography", "Biochemistry", "Problem Solving", "Lab Techniques"],
  "b.tech biotechnology": ["Biotechnology", "Molecular Biology", "PCR", "Gel Electrophoresis", "Cell Culture", "ELISA", "Chromatography", "Biochemistry", "Problem Solving", "Lab Techniques"],
  "b.sc biotechnology": ["Biotechnology", "Molecular Biology", "PCR", "Gel Electrophoresis", "Cell Culture", "ELISA", "Chromatography", "Biochemistry", "Problem Solving", "Lab Techniques"],
  "pharmacy": ["Pharmacy", "Pharmacology", "Drug Formulation", "Quality Control", "GMP", "HPLC", "Clinical Research", "Pharmacovigilance", "Problem Solving"],
  "bachelor of pharmacy": ["Pharmacy", "Pharmacology", "Drug Formulation", "Quality Control", "GMP", "HPLC", "Clinical Research", "Pharmacovigilance", "Problem Solving"],
  "b.pharm": ["Pharmacy", "Pharmacology", "Drug Formulation", "Quality Control", "GMP", "HPLC", "Clinical Research", "Pharmacovigilance", "Problem Solving"],
  "architecture": ["AutoCAD", "Revit", "3ds Max", "SketchUp", "Photoshop", "Architectural Design", "Project Management", "Construction Drawing", "Problem Solving"],
  "bachelor of architecture": ["AutoCAD", "Revit", "3ds Max", "SketchUp", "Photoshop", "Architectural Design", "Project Management", "Construction Drawing", "Problem Solving"],
  "b.arch": ["AutoCAD", "Revit", "3ds Max", "SketchUp", "Photoshop", "Architectural Design", "Project Management", "Construction Drawing", "Problem Solving"],
  "interior design": ["AutoCAD", "SketchUp", "3ds Max", "Photoshop", "Interior Design", "Space Planning", "Project Management", "Problem Solving"],
  "bachelor of interior design": ["AutoCAD", "SketchUp", "3ds Max", "Photoshop", "Interior Design", "Space Planning", "Project Management", "Problem Solving"],
  "instrumentation engineering": ["PLC", "SCADA", "Instrumentation", "Control Systems", "LabVIEW", "MATLAB", "Sensors", "Problem Solving", "Project Management"],
  "bachelor of instrumentation engineering": ["PLC", "SCADA", "Instrumentation", "Control Systems", "LabVIEW", "MATLAB", "Sensors", "Problem Solving", "Project Management"],
  "b.tech instrumentation": ["PLC", "SCADA", "Instrumentation", "Control Systems", "LabVIEW", "MATLAB", "Sensors", "Problem Solving", "Project Management"],
  "mechatronics engineering": ["Mechatronics", "PLC", "Robotics", "Embedded Systems", "Arduino", "Raspberry Pi", "CAD", "SolidWorks", "Automation", "Problem Solving", "Project Management"],
  "bachelor of mechatronics engineering": ["Mechatronics", "PLC", "Robotics", "Embedded Systems", "Arduino", "Raspberry Pi", "CAD", "SolidWorks", "Automation", "Problem Solving", "Project Management"],
  "b.tech mechatronics": ["Mechatronics", "PLC", "Robotics", "Embedded Systems", "Arduino", "Raspberry Pi", "CAD", "SolidWorks", "Automation", "Problem Solving", "Project Management"],
  "industrial engineering": ["Industrial Engineering", "Lean Manufacturing", "Six Sigma", "Operations Research", "Production Planning", "Quality Control", "Project Management", "Problem Solving"],
  "bachelor of industrial engineering": ["Industrial Engineering", "Lean Manufacturing", "Six Sigma", "Operations Research", "Production Planning", "Quality Control", "Project Management", "Problem Solving"],
  "b.tech industrial": ["Industrial Engineering", "Lean Manufacturing", "Six Sigma", "Operations Research", "Production Planning", "Quality Control", "Project Management", "Problem Solving"],
  "production engineering": ["Production Engineering", "Manufacturing", "Production Planning", "Quality Control", "Lean Manufacturing", "Six Sigma", "Project Management", "Problem Solving"],
  "bachelor of production engineering": ["Production Engineering", "Manufacturing", "Production Planning", "Quality Control", "Lean Manufacturing", "Six Sigma", "Project Management", "Problem Solving"],
  "b.tech production": ["Production Engineering", "Manufacturing", "Production Planning", "Quality Control", "Lean Manufacturing", "Six Sigma", "Project Management", "Problem Solving"],
  "automobile engineering": ["Automotive Engineering", "Vehicle Dynamics", "Powertrain", "IC Engines", "EV Technology", "CAD", "SolidWorks", "CATIA", "AutoCAD", "Manufacturing", "Problem Solving", "Project Management"],
  "automotive engineering": ["Automotive Engineering", "Vehicle Dynamics", "Powertrain", "IC Engines", "EV Technology", "CAD", "SolidWorks", "CATIA", "AutoCAD", "Manufacturing", "Problem Solving", "Project Management"],
  "bachelor of automobile engineering": ["Automotive Engineering", "Vehicle Dynamics", "Powertrain", "IC Engines", "EV Technology", "CAD", "SolidWorks", "CATIA", "AutoCAD", "Manufacturing", "Problem Solving", "Project Management"],
  "bachelor of automotive engineering": ["Automotive Engineering", "Vehicle Dynamics", "Powertrain", "IC Engines", "EV Technology", "CAD", "SolidWorks", "CATIA", "AutoCAD", "Manufacturing", "Problem Solving", "Project Management"],
  "agriculture": ["Agriculture", "Farm Management", "Crop Production", "Soil Science", "Irrigation", "Pesticide Management", "Agricultural Machinery", "Problem Solving", "Project Management"],
  "agricultural engineering": ["Agriculture", "Farm Management", "Crop Production", "Soil Science", "Irrigation", "Agricultural Machinery", "Tractor", "Problem Solving", "Project Management"],
  "bachelor of agricultural engineering": ["Agriculture", "Farm Management", "Crop Production", "Soil Science", "Irrigation", "Agricultural Machinery", "Tractor", "Problem Solving", "Project Management"],
  "b.tech agricultural engineering": ["Agriculture", "Farm Management", "Crop Production", "Soil Science", "Irrigation", "Agricultural Machinery", "Tractor", "Problem Solving", "Project Management"],
  "bachelor of science in agriculture": ["Agriculture", "Farm Management", "Crop Production", "Soil Science", "Irrigation", "Pesticide Management", "Agricultural Machinery", "Problem Solving", "Project Management"],
  "b.sc agriculture": ["Agriculture", "Farm Management", "Crop Production", "Soil Science", "Irrigation", "Pesticide Management", "Agricultural Machinery", "Problem Solving", "Project Management"],
  "dairy technology": ["Dairy Technology", "Milk Processing", "Food Safety", "Quality Control", "Problem Solving"],
  "bachelor of dairy technology": ["Dairy Technology", "Milk Processing", "Food Safety", "Quality Control", "Problem Solving"],
  "b.tech dairy technology": ["Dairy Technology", "Milk Processing", "Food Safety", "Quality Control", "Problem Solving"],
  "food technology": ["Food Technology", "Food Processing", "Food Safety", "Quality Control", "HACCP", "Problem Solving"],
  "bachelor of food technology": ["Food Technology", "Food Processing", "Food Safety", "Quality Control", "HACCP", "Problem Solving"],
  "b.tech food technology": ["Food Technology", "Food Processing", "Food Safety", "Quality Control", "HACCP", "Problem Solving"],
  "food science and technology": ["Food Technology", "Food Processing", "Food Safety", "Quality Control", "HACCP", "Problem Solving"],
  "b.sc food science": ["Food Technology", "Food Processing", "Food Safety", "Quality Control", "HACCP", "Problem Solving"],
  "leather technology": ["Leather Technology", "Footwear Design", "Leather Processing", "Problem Solving"],
  "bachelor of leather technology": ["Leather Technology", "Footwear Design", "Leather Processing", "Problem Solving"],
  "b.tech leather technology": ["Leather Technology", "Footwear Design", "Leather Processing", "Problem Solving"],
  "ceramic engineering": ["Ceramic Engineering", "Materials Science", "Kiln Operation", "Problem Solving"],
  "bachelor of ceramic engineering": ["Ceramic Engineering", "Materials Science", "Kiln Operation", "Problem Solving"],
  "b.tech ceramic engineering": ["Ceramic Engineering", "Materials Science", "Kiln Operation", "Problem Solving"],
  "glass technology": ["Glass Technology", "Materials Science", "Problem Solving"],
  "bachelor of glass technology": ["Glass Technology", "Materials Science", "Problem Solving"],
  "plastic technology": ["Plastic Technology", "Polymer Science", "Injection Molding", "Problem Solving"],
  "bachelor of plastic technology": ["Plastic Technology", "Polymer Science", "Injection Molding", "Problem Solving"],
  "b.tech plastic technology": ["Plastic Technology", "Polymer Science", "Injection Molding", "Problem Solving"],
  "rubber technology": ["Rubber Technology", "Polymer Science", "Vulcanization", "Problem Solving"],
  "bachelor of rubber technology": ["Rubber Technology", "Polymer Science", "Vulcanization", "Problem Solving"],
  "b.tech rubber technology": ["Rubber Technology", "Polymer Science", "Vulcanization", "Problem Solving"],
  "paper technology": ["Paper Technology", "Pulp and Paper", "Printing Technology", "Problem Solving"],
  "bachelor of paper technology": ["Paper Technology", "Pulp and Paper", "Printing Technology", "Problem Solving"],
  "b.tech paper technology": ["Paper Technology", "Pulp and Paper", "Printing Technology", "Problem Solving"],
  "printing technology": ["Printing Technology", "Offset Printing", "Flexography", "Prepress", "Problem Solving"],
  "bachelor of printing technology": ["Printing Technology", "Offset Printing", "Flexography", "Prepress", "Problem Solving"],
  "b.tech printing technology": ["Printing Technology", "Offset Printing", "Flexography", "Prepress", "Problem Solving"],
  "textile chemistry": ["Textile Chemistry", "Dyeing", "Printing", "Quality Control", "Problem Solving"],
  "bachelor of textile chemistry": ["Textile Chemistry", "Dyeing", "Printing", "Quality Control", "Problem Solving"],
  "b.tech textile chemistry": ["Textile Chemistry", "Dyeing", "Printing", "Quality Control", "Problem Solving"],
  "manufacturing engineering": ["Manufacturing", "Production Planning", "Quality Control", "Lean Manufacturing", "Six Sigma", "Project Management", "Problem Solving"],
  "bachelor of manufacturing engineering": ["Manufacturing", "Production Planning", "Quality Control", "Lean Manufacturing", "Six Sigma", "Project Management", "Problem Solving"],
  "b.tech manufacturing": ["Manufacturing", "Production Planning", "Quality Control", "Lean Manufacturing", "Six Sigma", "Project Management", "Problem Solving"],
  "automation engineering": ["Automation", "PLC", "SCADA", "Robotics", "Embedded Systems", "Problem Solving", "Project Management"],
  "bachelor of automation engineering": ["Automation", "PLC", "SCADA", "Robotics", "Embedded Systems", "Problem Solving", "Project Management"],
  "b.tech automation": ["Automation", "PLC", "SCADA", "Robotics", "Embedded Systems", "Problem Solving", "Project Management"],
  "mechatronics": ["Mechatronics", "PLC", "Robotics", "Embedded Systems", "CAD", "SolidWorks", "Automation", "Problem Solving", "Project Management"],
  "bachelor of mechatronics": ["Mechatronics", "PLC", "Robotics", "Embedded Systems", "CAD", "SolidWorks", "Automation", "Problem Solving", "Project Management"],
  "robotics engineering": ["Robotics", "Embedded Systems", "Arduino", "Raspberry Pi", "PLC", "CAD", "Problem Solving", "Project Management"],
  "bachelor of robotics engineering": ["Robotics", "Embedded Systems", "Arduino", "Raspberry Pi", "PLC", "CAD", "Problem Solving", "Project Management"],
  "b.tech robotics": ["Robotics", "Embedded Systems", "Arduino", "Raspberry Pi", "PLC", "CAD", "Problem Solving", "Project Management"],
  "nanotechnology": ["Nanotechnology", "Materials Science", "Research", "Problem Solving", "Laboratory Techniques"],
  "bachelor of nanotechnology": ["Nanotechnology", "Materials Science", "Research", "Problem Solving", "Laboratory Techniques"],
  "b.tech nanotechnology": ["Nanotechnology", "Materials Science", "Research", "Problem Solving", "Laboratory Techniques"],
  "marine biology": ["Marine Biology", "Oceanography", "Aquaculture", "Research", "Problem Solving", "Laboratory Techniques"],
  "b.sc marine biology": ["Marine Biology", "Oceanography", "Aquaculture", "Research", "Problem Solving", "Laboratory Techniques"],
  "fisheries science": ["Fisheries", "Aquaculture", "Fish Processing", "Problem Solving"],
  "bachelor of fisheries science": ["Fisheries", "Aquaculture", "Fish Processing", "Problem Solving"],
  "b.f.sc": ["Fisheries", "Aquaculture", "Fish Processing", "Problem Solving"],
  "veterinary science": ["Veterinary Science", "Animal Husbandry", "Animal Care", "Problem Solving"],
  "bachelor of veterinary science": ["Veterinary Science", "Animal Husbandry", "Animal Care", "Problem Solving"],
  "b.v.sc": ["Veterinary Science", "Animal Husbandry", "Animal Care", "Problem Solving"],
  "bachelor of veterinary science and animal husbandry": ["Veterinary Science", "Animal Husbandry", "Animal Care", "Problem Solving"],
  "b.v.sc and a.h": ["Veterinary Science", "Animal Husbandry", "Animal Care", "Problem Solving"],
  "animal husbandry": ["Animal Husbandry", "Veterinary Science", "Animal Care", "Problem Solving"],
  "b.sc animal husbandry": ["Animal Husbandry", "Veterinary Science", "Animal Care", "Problem Solving"],
  "sericulture": ["Sericulture", "Silk Production", "Textile", "Agriculture", "Problem Solving"],
  "b.sc sericulture": ["Sericulture", "Silk Production", "Textile", "Agriculture", "Problem Solving"],
  "horticulture": ["Horticulture", "Crop Production", "Floriculture", "Landscaping", "Problem Solving"],
  "b.sc horticulture": ["Horticulture", "Crop Production", "Floriculture", "Landscaping", "Problem Solving"],
  "bachelor of horticulture": ["Horticulture", "Crop Production", "Floriculture", "Landscaping", "Problem Solving"],
  "forestry": ["Forestry", "Environmental Science", "Conservation", "Wildlife", "Problem Solving"],
  "b.sc forestry": ["Forestry", "Environmental Science", "Conservation", "Wildlife", "Problem Solving"],
  "bachelor of forestry": ["Forestry", "Environmental Science", "Conservation", "Wildlife", "Problem Solving"],
  "environmental science": ["Environmental Science", "Ecology", "Sustainability", "Research", "Problem Solving"],
  "b.sc environmental science": ["Environmental Science", "Ecology", "Sustainability", "Research", "Problem Solving"],
  "m.sc environmental science": ["Environmental Science", "Ecology", "Sustainability", "Research", "Problem Solving"],
  "geology": ["Geology", "Mining", "Earth Science", "Research", "Problem Solving"],
  "b.sc geology": ["Geology", "Mining", "Earth Science", "Research", "Problem Solving"],
  "m.sc geology": ["Geology", "Mining", "Earth Science", "Research", "Problem Solving"],
  "geography": ["Geography", "GIS", "Remote Sensing", "Cartography", "Research", "Problem Solving"],
  "b.a geography": ["Geography", "GIS", "Remote Sensing", "Cartography", "Research", "Problem Solving"],
  "b.sc geography": ["Geography", "GIS", "Remote Sensing", "Cartography", "Research", "Problem Solving"],
  "m.a geography": ["Geography", "GIS", "Remote Sensing", "Cartography", "Research", "Problem Solving"],
  "m.sc geography": ["Geography", "GIS", "Remote Sensing", "Cartography", "Research", "Problem Solving"],

  // Medicine / Healthcare
  "bachelor of medicine bachelor of surgery": ["Medical Knowledge", "Patient Care", "Diagnosis", "Clinical Skills", "Communication", "Problem Solving", "Medical Documentation"],
  "m.b.b.s": ["Medical Knowledge", "Patient Care", "Diagnosis", "Clinical Skills", "Communication", "Problem Solving", "Medical Documentation"],
  "bachelor of dental surgery": ["Dental Knowledge", "Patient Care", "Clinical Skills", "Communication", "Problem Solving"],
  "b.d.s": ["Dental Knowledge", "Patient Care", "Clinical Skills", "Communication", "Problem Solving"],
  "bachelor of ayurvedic medicine and surgery": ["Ayurveda", "Patient Care", "Clinical Skills", "Communication", "Problem Solving"],
  "b.a.m.s": ["Ayurveda", "Patient Care", "Clinical Skills", "Communication", "Problem Solving"],
  "bachelor of homeopathic medicine and surgery": ["Homeopathy", "Patient Care", "Clinical Skills", "Communication", "Problem Solving"],
  "b.h.m.s": ["Homeopathy", "Patient Care", "Clinical Skills", "Communication", "Problem Solving"],
  "bachelor of science in nursing": ["Nursing", "Patient Care", "Clinical Skills", "Communication", "Problem Solving", "Medical Documentation"],
  "b.sc nursing": ["Nursing", "Patient Care", "Clinical Skills", "Communication", "Problem Solving", "Medical Documentation"],
  "general nursing and midwifery": ["Nursing", "Patient Care", "Clinical Skills", "Communication", "Problem Solving", "Medical Documentation"],
  "g.n.m": ["Nursing", "Patient Care", "Clinical Skills", "Communication", "Problem Solving", "Medical Documentation"],
  "auxiliary nurse midwife": ["Nursing", "Patient Care", "Clinical Skills", "Communication", "Problem Solving", "Medical Documentation"],
  "a.n.m": ["Nursing", "Patient Care", "Clinical Skills", "Communication", "Problem Solving", "Medical Documentation"],
  "physiotherapy": ["Physiotherapy", "Patient Care", "Rehabilitation", "Clinical Skills", "Communication", "Problem Solving"],
  "bachelor of physiotherapy": ["Physiotherapy", "Patient Care", "Rehabilitation", "Clinical Skills", "Communication", "Problem Solving"],
  "b.p.t": ["Physiotherapy", "Patient Care", "Rehabilitation", "Clinical Skills", "Communication", "Problem Solving"],
  "m.p.t": ["Physiotherapy", "Patient Care", "Rehabilitation", "Clinical Skills", "Communication", "Problem Solving"],
  "occupational therapy": ["Occupational Therapy", "Patient Care", "Rehabilitation", "Clinical Skills", "Communication", "Problem Solving"],
  "bachelor of occupational therapy": ["Occupational Therapy", "Patient Care", "Rehabilitation", "Clinical Skills", "Communication", "Problem Solving"],
  "b.o.t": ["Occupational Therapy", "Patient Care", "Rehabilitation", "Clinical Skills", "Communication", "Problem Solving"],
  "speech therapy": ["Speech Therapy", "Audiology", "Communication", "Patient Care", "Problem Solving"],
  "bachelor of speech therapy": ["Speech Therapy", "Audiology", "Communication", "Patient Care", "Problem Solving"],
  "b.a.s.l.p": ["Speech Therapy", "Audiology", "Communication", "Patient Care", "Problem Solving"],
  "audiology": ["Audiology", "Speech Therapy", "Patient Care", "Problem Solving"],
  "b.sc audiology": ["Audiology", "Speech Therapy", "Patient Care", "Problem Solving"],
  "optometry": ["Optometry", "Eye Care", "Clinical Skills", "Patient Care", "Problem Solving"],
  "bachelor of optometry": ["Optometry", "Eye Care", "Clinical Skills", "Patient Care", "Problem Solving"],
  "b.optom": ["Optometry", "Eye Care", "Clinical Skills", "Patient Care", "Problem Solving"],
  "medical laboratory technology": ["Medical Laboratory Technology", "Lab Techniques", "Clinical Skills", "Problem Solving"],
  "b.sc ml t": ["Medical Laboratory Technology", "Lab Techniques", "Clinical Skills", "Problem Solving"],
  "b.m.l.t": ["Medical Laboratory Technology", "Lab Techniques", "Clinical Skills", "Problem Solving"],
  "radiography": ["Radiography", "X-Ray", "Imaging", "Clinical Skills", "Patient Care", "Problem Solving"],
  "bachelor of radiography": ["Radiography", "X-Ray", "Imaging", "Clinical Skills", "Patient Care", "Problem Solving"],
  "b.sc radiography": ["Radiography", "X-Ray", "Imaging", "Clinical Skills", "Patient Care", "Problem Solving"],
  "dialysis technology": ["Dialysis Technology", "Patient Care", "Clinical Skills", "Problem Solving"],
  "b.sc dialysis": ["Dialysis Technology", "Patient Care", "Clinical Skills", "Problem Solving"],
  "operation theatre technology": ["Operation Theatre Technology", "Patient Care", "Clinical Skills", "Surgical Assistance", "Problem Solving"],
  "b.sc ott": ["Operation Theatre Technology", "Patient Care", "Clinical Skills", "Surgical Assistance", "Problem Solving"],
  "anesthesia technology": ["Anesthesia Technology", "Patient Care", "Clinical Skills", "Surgical Assistance", "Problem Solving"],
  "b.sc anesthesia": ["Anesthesia Technology", "Patient Care", "Clinical Skills", "Surgical Assistance", "Problem Solving"],
  "cardiac care technology": ["Cardiac Care Technology", "Patient Care", "Clinical Skills", "Problem Solving"],
  "b.sc cardiac care": ["Cardiac Care Technology", "Patient Care", "Clinical Skills", "Problem Solving"],
  "respiratory therapy": ["Respiratory Therapy", "Patient Care", "Clinical Skills", "Problem Solving"],
  "b.sc respiratory therapy": ["Respiratory Therapy", "Patient Care", "Clinical Skills", "Problem Solving"],
  "nutrition and dietetics": ["Nutrition", "Dietetics", "Food Science", "Patient Care", "Problem Solving"],
  "b.sc nutrition": ["Nutrition", "Dietetics", "Food Science", "Patient Care", "Problem Solving"],
  "m.sc nutrition": ["Nutrition", "Dietetics", "Food Science", "Patient Care", "Problem Solving"],
  "occupational health": ["Occupational Health", "Safety", "Industrial Hygiene", "Problem Solving"],
  "b.sc occupational health": ["Occupational Health", "Safety", "Industrial Hygiene", "Problem Solving"],

  // Commerce / Business
  "bachelor of commerce": ["Accounting", "Excel", "Tally", "Financial Analysis", "Banking Operations", "MIS Reporting", "Business Analysis", "GST", "Auditing", "Taxation", "Payroll", "Communication"],
  "b.com": ["Accounting", "Excel", "Tally", "Financial Analysis", "Banking Operations", "MIS Reporting", "Business Analysis", "GST", "Auditing", "Taxation", "Payroll", "Communication"],
  "bachelor of business administration": ["Business Analysis", "Project Management", "Operations", "Communication", "Excel", "CRM", "Marketing", "Sales", "Business Development", "Customer Success", "Leadership"],
  "bba": ["Business Analysis", "Project Management", "Operations", "Communication", "Excel", "CRM", "Marketing", "Sales", "Business Development", "Customer Success", "Leadership"],
  "master of business administration": ["Project Management", "Business Analysis", "Operations", "Strategic Planning", "Leadership", "Financial Analysis", "Negotiation", "Change Management", "Stakeholder Management", "Business Strategy"],
  "mba": ["Project Management", "Business Analysis", "Operations", "Strategic Planning", "Leadership", "Financial Analysis", "Negotiation", "Change Management", "Stakeholder Management", "Business Strategy"],
  "bachelor of commerce in accounting": ["Accounting", "Excel", "Tally", "Financial Analysis", "Auditing", "Taxation", "Communication"],
  "b.com accounting": ["Accounting", "Excel", "Tally", "Financial Analysis", "Auditing", "Taxation", "Communication"],
  "bachelor of commerce in finance": ["Financial Analysis", "Excel", "Tally", "Banking Operations", "Investment", "Risk Management", "Problem Solving"],
  "b.com finance": ["Financial Analysis", "Excel", "Tally", "Banking Operations", "Investment", "Risk Management", "Problem Solving"],
  "bachelor of commerce in taxation": ["Taxation", "Accounting", "Excel", "GST", "Auditing", "Problem Solving"],
  "b.com taxation": ["Taxation", "Accounting", "Excel", "GST", "Auditing", "Problem Solving"],
  "bachelor of commerce in computer applications": ["Accounting", "Excel", "Tally", "Computer Applications", "Data Entry", "Problem Solving"],
  "b.com ca": ["Accounting", "Excel", "Tally", "Computer Applications", "Data Entry", "Problem Solving"],
  "bachelor of commerce in e-commerce": ["E-commerce", "Digital Marketing", "Accounting", "Excel", "Problem Solving"],
  "b.com e-commerce": ["E-commerce", "Digital Marketing", "Accounting", "Excel", "Problem Solving"],
  "bachelor of commerce in banking": ["Banking Operations", "Accounting", "Excel", "Financial Analysis", "Problem Solving"],
  "b.com banking": ["Banking Operations", "Accounting", "Excel", "Financial Analysis", "Problem Solving"],
  "bachelor of commerce in insurance": ["Insurance", "Accounting", "Excel", "Risk Management", "Problem Solving"],
  "b.com insurance": ["Insurance", "Accounting", "Excel", "Risk Management", "Problem Solving"],
  "bachelor of commerce in marketing": ["Marketing", "Sales", "Business Development", "Communication", "Excel", "Problem Solving"],
  "b.com marketing": ["Marketing", "Sales", "Business Development", "Communication", "Excel", "Problem Solving"],
  "bachelor of commerce in international business": ["International Business", "Export Import", "Logistics", "Communication", "Problem Solving"],
  "b.com ib": ["International Business", "Export Import", "Logistics", "Communication", "Problem Solving"],
  "chartered accountancy": ["Accounting", "Audit", "Taxation", "Financial Analysis", "Excel", "Communication", "Problem Solving"],
  "c.a": ["Accounting", "Audit", "Taxation", "Financial Analysis", "Excel", "Communication", "Problem Solving"],
  "company secretary": ["Company Law", "Corporate Governance", "Compliance", "Secretarial Practice", "Communication", "Problem Solving"],
  "c.s": ["Company Law", "Corporate Governance", "Compliance", "Secretarial Practice", "Communication", "Problem Solving"],
  "cost and management accountancy": ["Cost Accounting", "Financial Analysis", "Excel", "Audit", "Problem Solving"],
  "c.m.a": ["Cost Accounting", "Financial Analysis", "Excel", "Audit", "Problem Solving"],
  "cma": ["Cost Accounting", "Financial Analysis", "Excel", "Audit", "Problem Solving"],

  // Computer Applications
  "bachelor of computer applications": ["Python", "Java", "JavaScript", "SQL", "Git", "Web Development", "REST APIs", "HTML", "CSS", "React", "Problem Solving", "Database Management"],
  "bca": ["Python", "Java", "JavaScript", "SQL", "Git", "Web Development", "REST APIs", "HTML", "CSS", "React", "Problem Solving", "Database Management"],
  "master of computer applications": ["Python", "Java", "JavaScript", "SQL", "Git", "REST APIs", "Data Analysis", "Project Management", "Problem Solving", "AWS", "Docker", "System Design"],
  "mca": ["Python", "Java", "JavaScript", "SQL", "Git", "REST APIs", "Data Analysis", "Project Management", "Problem Solving", "AWS", "Docker", "System Design"],

  // Law
  "bachelor of laws": ["Legal Research", "Legal Writing", "Litigation", "Contract Law", "Communication", "Negotiation", "Problem Solving", "Documentation"],
  "ll.b": ["Legal Research", "Legal Writing", "Litigation", "Contract Law", "Communication", "Negotiation", "Problem Solving", "Documentation"],
  "bachelor of arts bachelor of laws": ["Legal Research", "Legal Writing", "Litigation", "Contract Law", "Communication", "Negotiation", "Problem Solving", "Documentation"],
  "b.a ll.b": ["Legal Research", "Legal Writing", "Litigation", "Contract Law", "Communication", "Negotiation", "Problem Solving", "Documentation"],
  "bachelor of business administration bachelor of laws": ["Legal Research", "Legal Writing", "Litigation", "Contract Law", "Communication", "Negotiation", "Problem Solving", "Documentation"],
  "b.b.a ll.b": ["Legal Research", "Legal Writing", "Litigation", "Contract Law", "Communication", "Negotiation", "Problem Solving", "Documentation"],
  "master of laws": ["Legal Research", "Legal Writing", "Litigation", "Contract Law", "Communication", "Negotiation", "Problem Solving", "Documentation"],
  "ll.m": ["Legal Research", "Legal Writing", "Litigation", "Contract Law", "Communication", "Negotiation", "Problem Solving", "Documentation"],
  "bachelor of legislative law": ["Legal Research", "Legal Writing", "Litigation", "Contract Law", "Communication", "Negotiation", "Problem Solving", "Documentation"],
  "b.b.a.ll.b": ["Legal Research", "Legal Writing", "Litigation", "Contract Law", "Communication", "Negotiation", "Problem Solving", "Documentation"],
  "b.com.ll.b": ["Legal Research", "Legal Writing", "Litigation", "Contract Law", "Communication", "Negotiation", "Problem Solving", "Documentation"],
  "b.sc.ll.b": ["Legal Research", "Legal Writing", "Litigation", "Contract Law", "Communication", "Negotiation", "Problem Solving", "Documentation"],
  "bachelor of business law": ["Legal Research", "Legal Writing", "Contract Law", "Business Law", "Communication", "Negotiation", "Problem Solving"],
  "b.b.l": ["Legal Research", "Legal Writing", "Contract Law", "Business Law", "Communication", "Negotiation", "Problem Solving"],
  "master of business law": ["Legal Research", "Legal Writing", "Contract Law", "Business Law", "Communication", "Negotiation", "Problem Solving"],
  "m.b.l": ["Legal Research", "Legal Writing", "Contract Law", "Business Law", "Communication", "Negotiation", "Problem Solving"],
  "diploma in cyber law": ["Cyber Law", "Legal Research", "IT Law", "Communication", "Problem Solving"],
  "diploma in labour law": ["Labour Law", "Legal Research", "HR", "Communication", "Problem Solving"],
  "diploma in tax law": ["Tax Law", "Legal Research", "Accounting", "Communication", "Problem Solving"],

  // Arts / Humanities / Science
  "bachelor of arts": ["Communication", "Writing", "Research", "Critical Thinking", "Teamwork", "Problem Solving", "Content Writing", "Public Speaking", "Content Creation"],
  "b.a": ["Communication", "Writing", "Research", "Critical Thinking", "Teamwork", "Problem Solving", "Content Writing", "Public Speaking", "Content Creation"],
  "master of arts": ["Communication", "Writing", "Research", "Critical Thinking", "Teamwork", "Problem Solving", "Content Writing", "Public Speaking", "Content Creation"],
  "m.a": ["Communication", "Writing", "Research", "Critical Thinking", "Teamwork", "Problem Solving", "Content Writing", "Public Speaking", "Content Creation"],
  "bachelor of science": ["Data Analysis", "Excel", "Statistics", "Research", "Problem Solving", "Communication", "Python", "Laboratory Techniques", "Data Visualization"],
  "b.sc": ["Data Analysis", "Excel", "Statistics", "Research", "Problem Solving", "Communication", "Python", "Laboratory Techniques", "Data Visualization"],
  "master of science": ["Data Analysis", "Excel", "Statistics", "Research", "Problem Solving", "Communication", "Python", "Laboratory Techniques", "Data Visualization"],
  "m.sc": ["Data Analysis", "Excel", "Statistics", "Research", "Problem Solving", "Communication", "Python", "Laboratory Techniques", "Data Visualization"],
  "bachelor of arts in english": ["Communication", "Writing", "Research", "Content Writing", "Editing", "Problem Solving"],
  "b.a english": ["Communication", "Writing", "Research", "Content Writing", "Editing", "Problem Solving"],
  "m.a english": ["Communication", "Writing", "Research", "Content Writing", "Editing", "Problem Solving"],
  "bachelor of arts in hindi": ["Communication", "Writing", "Research", "Translation", "Problem Solving"],
  "b.a hindi": ["Communication", "Writing", "Research", "Translation", "Problem Solving"],
  "m.a hindi": ["Communication", "Writing", "Research", "Translation", "Problem Solving"],
  "bachelor of arts in regional language": ["Communication", "Writing", "Research", "Translation", "Problem Solving"],
  "bachelor of sociology": ["Sociology", "Research", "Communication", "Problem Solving", "Social Work", "Counseling"],
  "b.a sociology": ["Sociology", "Research", "Communication", "Problem Solving", "Social Work", "Counseling"],
  "m.a sociology": ["Sociology", "Research", "Communication", "Problem Solving", "Social Work", "Counseling"],
  "bachelor of psychology": ["Psychology", "Counseling", "Communication", "Research", "Problem Solving", "Active Listening"],
  "b.a psychology": ["Psychology", "Counseling", "Communication", "Research", "Problem Solving", "Active Listening"],
  "b.sc psychology": ["Psychology", "Counseling", "Communication", "Research", "Problem Solving", "Active Listening"],
  "m.a psychology": ["Psychology", "Counseling", "Communication", "Research", "Problem Solving", "Active Listening"],
  "m.sc psychology": ["Psychology", "Counseling", "Communication", "Research", "Problem Solving", "Active Listening"],
  "bachelor of political science": ["Political Science", "Research", "Communication", "Public Administration", "Problem Solving"],
  "b.a political science": ["Political Science", "Research", "Communication", "Public Administration", "Problem Solving"],
  "m.a political science": ["Political Science", "Research", "Communication", "Public Administration", "Problem Solving"],
  "bachelor of history": ["History", "Research", "Communication", "Writing", "Critical Thinking", "Problem Solving"],
  "b.a history": ["History", "Research", "Communication", "Writing", "Critical Thinking", "Problem Solving"],
  "m.a history": ["History", "Research", "Communication", "Writing", "Critical Thinking", "Problem Solving"],
  "bachelor of economics": ["Economics", "Data Analysis", "Statistics", "Research", "Excel", "Problem Solving"],
  "b.a economics": ["Economics", "Data Analysis", "Statistics", "Research", "Excel", "Problem Solving"],
  "b.sc economics": ["Economics", "Data Analysis", "Statistics", "Research", "Excel", "Problem Solving"],
  "m.a economics": ["Economics", "Data Analysis", "Statistics", "Research", "Excel", "Problem Solving"],
  "m.sc economics": ["Economics", "Data Analysis", "Statistics", "Research", "Excel", "Problem Solving"],
  "bachelor of philosophy": ["Philosophy", "Critical Thinking", "Research", "Writing", "Communication", "Problem Solving"],
  "b.a philosophy": ["Philosophy", "Critical Thinking", "Research", "Writing", "Communication", "Problem Solving"],
  "m.a philosophy": ["Philosophy", "Critical Thinking", "Research", "Writing", "Communication", "Problem Solving"],
  "bachelor of public administration": ["Public Administration", "Communication", "Research", "Problem Solving", "Governance"],
  "b.a public administration": ["Public Administration", "Communication", "Research", "Problem Solving", "Governance"],
  "m.a public administration": ["Public Administration", "Communication", "Research", "Problem Solving", "Governance"],

  // Diplomas / ITI / Polytechnic
  "diploma in mechanical engineering": ["CAD", "AutoCAD", "Manufacturing", "Production Planning", "Quality Control", "Maintenance", "Workshop Technology", "Problem Solving", "Project Management"],
  "diploma in computer science": ["Python", "Java", "JavaScript", "SQL", "Git", "Technical Support", "Networking", "HTML", "CSS", "Problem Solving"],
  "diploma in electrical engineering": ["PLC", "Electrical Design", "Maintenance", "Power Systems", "AutoCAD Electrical", "Problem Solving"],
  "diploma in civil engineering": ["AutoCAD", "Construction Management", "Quality Control", "Project Management", "Site Supervision", "Problem Solving"],
  "diploma in electronics and communication engineering": ["Embedded Systems", "Circuit Design", "Arduino", "PLC", "SCADA", "Networking", "PCB Design", "Problem Solving"],
  "diploma in chemical engineering": ["Chemical Process Design", "Plant Design", "Safety Engineering", "Quality Control", "Problem Solving"],
  "diploma in aeronautical engineering": ["Aerodynamics", "Aircraft Design", "CATIA", "NX", "ANSYS", "CFD", "FEA", "Problem Solving", "Project Management"],
  "diploma in aerospace engineering": ["Aerodynamics", "Aircraft Design", "CATIA", "NX", "ANSYS", "CFD", "FEA", "Flight Mechanics", "Propulsion", "Problem Solving", "Project Management"],
  "diploma in marine engineering": ["Marine Engineering", "Naval Architecture", "Ship Design", "Marine Propulsion", "Maintenance", "Welding", "Problem Solving", "Project Management"],
  "diploma in mining engineering": ["Mining Engineering", "Mine Planning", "Blasting", "Ventilation", "Geology", "Mining Software", "Safety", "Problem Solving", "Project Management"],
  "diploma in petroleum engineering": ["Petroleum Engineering", "Reservoir Engineering", "Drilling", "Petrel", "Eclipse", "Production Engineering", "Problem Solving", "Project Management"],
  "diploma in textile engineering": ["Textile Engineering", "Spinning", "Weaving", "Dyeing", "Printing", "Garment Manufacturing", "Quality Control", "Problem Solving"],
  "diploma in biotechnology": ["Biotechnology", "Molecular Biology", "PCR", "Gel Electrophoresis", "Cell Culture", "ELISA", "Chromatography", "Biochemistry", "Problem Solving", "Lab Techniques"],
  "diploma in pharmacy": ["Pharmacy", "Pharmacology", "Drug Formulation", "Quality Control", "GMP", "HPLC", "Problem Solving"],
  "d.pharm": ["Pharmacy", "Pharmacology", "Drug Formulation", "Quality Control", "GMP", "HPLC", "Problem Solving"],
  "diploma in architecture": ["AutoCAD", "Revit", "3ds Max", "SketchUp", "Photoshop", "Architectural Design", "Project Management", "Construction Drawing", "Problem Solving"],
  "diploma in interior design": ["AutoCAD", "SketchUp", "3ds Max", "Photoshop", "Interior Design", "Space Planning", "Project Management", "Problem Solving"],
  "industrial training institute": ["Technical Skills", "Trade Skills", "Problem Solving", "Safety", "Communication"],
  "i.t.i": ["Technical Skills", "Trade Skills", "Problem Solving", "Safety", "Communication"],
  "diploma in automobile engineering": ["Automotive Engineering", "Vehicle Dynamics", "Powertrain", "IC Engines", "CAD", "AutoCAD", "Manufacturing", "Problem Solving", "Project Management"],
  "diploma in electronics and communication": ["Embedded Systems", "Circuit Design", "Arduino", "PLC", "SCADA", "Networking", "PCB Design", "Problem Solving"],
  "diploma in hotel management": ["Hospitality", "Customer Service", "Food & Beverage", "Front Office", "Housekeeping", "Event Management", "Communication", "Problem Solving"],
  "diploma in travel and tourism": ["Travel", "Tourism", "Hospitality", "Customer Service", "Communication", "Problem Solving"],
  "diploma in event management": ["Event Management", "Planning", "Communication", "Project Management", "Problem Solving"],
  "diploma in culinary arts": ["Culinary Arts", "Food Production", "Kitchen Management", "Hospitality", "Problem Solving"],
  "diploma in bakery and confectionery": ["Bakery", "Confectionery", "Food Production", "Hospitality", "Problem Solving"],
  "diploma in front office operations": ["Front Office", "Hospitality", "Customer Service", "Communication", "Problem Solving"],
  "diploma in housekeeping": ["Housekeeping", "Hospitality", "Cleaning Management", "Problem Solving"],
  "diploma in food and beverage service": ["Food & Beverage", "Hospitality", "Customer Service", "Problem Solving"],
  "diploma in interior decoration": ["Interior Design", "Space Planning", "AutoCAD", "SketchUp", "Problem Solving"],
  "diploma in fashion illustration": ["Fashion Design", "Illustration", "Sketching", "Creativity", "Problem Solving"],
  "diploma in textile design": ["Textile Design", "Weaving", "Dyeing", "Printing", "Creativity", "Problem Solving"],
  "diploma in jewellery design": ["Jewelry Design", "Fashion Design", "Creativity", "Problem Solving"],
  "diploma in makeup artistry": ["Makeup Artistry", "Cosmetology", "Beauty", "Problem Solving"],
  "diploma in cosmetology": ["Cosmetology", "Beauty", "Skin Care", "Hair Care", "Problem Solving"],
  "diploma in beauty and wellness": ["Beauty", "Wellness", "Spa", "Massage", "Problem Solving"],
  "diploma in yoga": ["Yoga", "Wellness", "Fitness", "Communication", "Problem Solving"],
  "diploma in naturopathy": ["Naturopathy", "Wellness", "Health Care", "Problem Solving"],
  "diploma in physiotherapy": ["Physiotherapy", "Patient Care", "Rehabilitation", "Clinical Skills", "Problem Solving"],
  "diploma in nursing": ["Nursing", "Patient Care", "Clinical Skills", "Communication", "Problem Solving"],
  "diploma in medical lab technology": ["Medical Laboratory Technology", "Lab Techniques", "Clinical Skills", "Problem Solving"],
  "diploma in radiology": ["Radiography", "X-Ray", "Imaging", "Clinical Skills", "Problem Solving"],
  "diploma in operation theatre technology": ["Operation Theatre Technology", "Patient Care", "Clinical Skills", "Problem Solving"],
  "diploma in dialysis technology": ["Dialysis Technology", "Patient Care", "Clinical Skills", "Problem Solving"],
  "diploma in optometry": ["Optometry", "Eye Care", "Clinical Skills", "Patient Care", "Problem Solving"],
  "diploma in computer applications": ["Computer Applications", "MS Office", "Data Entry", "Basic Computer Skills", "Problem Solving"],
  "d.c.a": ["Computer Applications", "MS Office", "Data Entry", "Basic Computer Skills", "Problem Solving"],
  "post graduate diploma in computer applications": ["Computer Applications", "Python", "Java", "SQL", "Web Development", "Problem Solving"],
  "p.g.d.c.a": ["Computer Applications", "Python", "Java", "SQL", "Web Development", "Problem Solving"],

  // Education / Teaching
  "bachelor of education": ["Teaching", "Lesson Planning", "Classroom Management", "Communication", "Child Psychology", "Curriculum Development", "Problem Solving"],
  "b.ed": ["Teaching", "Lesson Planning", "Classroom Management", "Communication", "Child Psychology", "Curriculum Development", "Problem Solving"],
  "master of education": ["Teaching", "Lesson Planning", "Classroom Management", "Communication", "Child Psychology", "Curriculum Development", "Problem Solving", "Educational Leadership"],
  "m.ed": ["Teaching", "Lesson Planning", "Classroom Management", "Communication", "Child Psychology", "Curriculum Development", "Problem Solving", "Educational Leadership"],
  "diploma in elementary education": ["Teaching", "Lesson Planning", "Classroom Management", "Communication", "Child Psychology", "Curriculum Development", "Problem Solving"],
  "d.el.ed": ["Teaching", "Lesson Planning", "Classroom Management", "Communication", "Child Psychology", "Curriculum Development", "Problem Solving"],
  "nursery teacher training": ["Teaching", "Lesson Planning", "Classroom Management", "Communication", "Child Psychology", "Problem Solving"],
  "n.t.t": ["Teaching", "Lesson Planning", "Classroom Management", "Communication", "Child Psychology", "Problem Solving"],
  "bachelor of physical education": ["Physical Education", "Sports", "Coaching", "Fitness", "Communication", "Problem Solving"],
  "b.p.e": ["Physical Education", "Sports", "Coaching", "Fitness", "Communication", "Problem Solving"],
  "bachelor of sports management": ["Sports Management", "Event Management", "Communication", "Project Management", "Problem Solving"],
  "b.s.m": ["Sports Management", "Event Management", "Communication", "Project Management", "Problem Solving"],
  "bachelor of library science": ["Library Science", "Information Management", "Research", "Cataloging", "Communication", "Problem Solving"],
  "b.l.i.s": ["Library Science", "Information Management", "Research", "Cataloging", "Communication", "Problem Solving"],
  "master of library science": ["Library Science", "Information Management", "Research", "Cataloging", "Communication", "Problem Solving"],
  "m.l.i.s": ["Library Science", "Information Management", "Research", "Cataloging", "Communication", "Problem Solving"],
  "diploma in library science": ["Library Science", "Information Management", "Research", "Cataloging", "Communication", "Problem Solving"],
  "d.l.i.s": ["Library Science", "Information Management", "Research", "Cataloging", "Communication", "Problem Solving"],

  // Design / Creative
  "bachelor of design": ["Graphic Design", "UI Design", "UX Design", "Figma", "Photoshop", "Illustrator", "Creativity", "Problem Solving"],
  "b.des": ["Graphic Design", "UI Design", "UX Design", "Figma", "Photoshop", "Illustrator", "Creativity", "Problem Solving"],
  "bachelor of fine arts": ["Fine Arts", "Drawing", "Painting", "Sketching", "Creativity", "Problem Solving"],
  "b.f.a": ["Fine Arts", "Drawing", "Painting", "Sketching", "Creativity", "Problem Solving"],
  "master of fine arts": ["Fine Arts", "Drawing", "Painting", "Sketching", "Creativity", "Problem Solving"],
  "m.f.a": ["Fine Arts", "Drawing", "Painting", "Sketching", "Creativity", "Problem Solving"],
  "bachelor of fashion communication": ["Fashion Design", "Communication", "Content Writing", "Social Media", "Creativity", "Problem Solving"],
  "b.f.c": ["Fashion Design", "Communication", "Content Writing", "Social Media", "Creativity", "Problem Solving"],
  "bachelor of accessory design": ["Accessory Design", "Jewelry Design", "Fashion Design", "Creativity", "Problem Solving"],
  "bachelor of knitwear design": ["Knitwear Design", "Textile Design", "Fashion Design", "Creativity", "Problem Solving"],
  "bachelor of leather design": ["Leather Design", "Fashion Design", "Creativity", "Problem Solving"],
  "bachelor of product design": ["Product Design", "CAD", "Creativity", "Problem Solving", "Project Management"],
  "b.des product": ["Product Design", "CAD", "Creativity", "Problem Solving", "Project Management"],
  "bachelor of communication design": ["Communication Design", "Graphic Design", "UI Design", "UX Design", "Creativity", "Problem Solving"],
  "b.des communication": ["Communication Design", "Graphic Design", "UI Design", "UX Design", "Creativity", "Problem Solving"],
  "bachelor of animation": ["Animation", "2D Animation", "3D Animation", "Motion Graphics", "Creativity", "Problem Solving"],
  "b.sc animation": ["Animation", "2D Animation", "3D Animation", "Motion Graphics", "Creativity", "Problem Solving"],
  "bachelor of multimedia": ["Multimedia", "Graphic Design", "Video Editing", "Animation", "Creativity", "Problem Solving"],
  "b.sc multimedia": ["Multimedia", "Graphic Design", "Video Editing", "Animation", "Creativity", "Problem Solving"],
  "bachelor of film making": ["Film Making", "Video Editing", "Cinematography", "Direction", "Creativity", "Problem Solving"],
  "b.sc film making": ["Film Making", "Video Editing", "Cinematography", "Direction", "Creativity", "Problem Solving"],
  "bachelor of photography": ["Photography", "Photo Editing", "Creativity", "Problem Solving"],
  "b.sc photography": ["Photography", "Photo Editing", "Creativity", "Problem Solving"],
  "diploma in fashion design": ["Fashion Design", "Textile Design", "Garment Manufacturing", "Pattern Making", "Illustration", "Creativity", "Problem Solving"],
  "diploma in graphic design": ["Graphic Design", "Photoshop", "Illustrator", "CorelDRAW", "Creativity", "Problem Solving"],
  "diploma in animation": ["Animation", "2D Animation", "3D Animation", "Motion Graphics", "Creativity", "Problem Solving"],
  "diploma in web design": ["Web Design", "HTML", "CSS", "JavaScript", "Figma", "UI Design", "Problem Solving"],
  "bachelor of fashion technology": ["Fashion Design", "Textile Design", "Garment Manufacturing", "Pattern Making", "Illustration", "Creativity", "Problem Solving"],
  "b.f.tech": ["Fashion Design", "Textile Design", "Garment Manufacturing", "Pattern Making", "Illustration", "Creativity", "Problem Solving"],
  "bachelor of fashion design": ["Fashion Design", "Textile Design", "Garment Manufacturing", "Pattern Making", "Illustration", "Creativity", "Problem Solving"],

  // Hotel Management / Hospitality
  "bachelor of hotel management": ["Hospitality", "Customer Service", "Food & Beverage", "Front Office", "Housekeeping", "Event Management", "Communication", "Problem Solving"],
  "b.h.m": ["Hospitality", "Customer Service", "Food & Beverage", "Front Office", "Housekeeping", "Event Management", "Communication", "Problem Solving"],
  "bachelor of hospitality management": ["Hospitality", "Customer Service", "Food & Beverage", "Front Office", "Housekeeping", "Event Management", "Communication", "Problem Solving"],
  "bachelor of hotel management and catering technology": ["Hospitality", "Customer Service", "Food & Beverage", "Front Office", "Housekeeping", "Event Management", "Communication", "Problem Solving"],
  "b.h.m.c.t": ["Hospitality", "Customer Service", "Food & Beverage", "Front Office", "Housekeeping", "Event Management", "Communication", "Problem Solving"],
  "bachelor of travel and tourism management": ["Travel", "Tourism", "Hospitality", "Customer Service", "Communication", "Problem Solving"],
  "b.t.t.m": ["Travel", "Tourism", "Hospitality", "Customer Service", "Communication", "Problem Solving"],
  "bachelor of event management": ["Event Management", "Planning", "Communication", "Project Management", "Problem Solving"],
  "b.e.m": ["Event Management", "Planning", "Communication", "Project Management", "Problem Solving"],

  // Social Work / Psychology / Mass Comm
  "bachelor of social work": ["Social Work", "Community Development", "Counseling", "Communication", "Problem Solving", "Case Management"],
  "b.s.w": ["Social Work", "Community Development", "Counseling", "Communication", "Problem Solving", "Case Management"],
  "master of social work": ["Social Work", "Community Development", "Counseling", "Communication", "Problem Solving", "Case Management"],
  "m.s.w": ["Social Work", "Community Development", "Counseling", "Communication", "Problem Solving", "Case Management"],
  "bachelor of mass communication": ["Communication", "Content Writing", "Journalism", "Public Relations", "Media Production", "Social Media", "Problem Solving"],
  "b.m.m.c": ["Communication", "Content Writing", "Journalism", "Public Relations", "Media Production", "Social Media", "Problem Solving"],
  "bachelor of journalism": ["Communication", "Content Writing", "Journalism", "Public Relations", "Media Production", "Social Media", "Problem Solving"],
  "bachelor of journalism and mass communication": ["Communication", "Content Writing", "Journalism", "Public Relations", "Media Production", "Social Media", "Problem Solving"],
  "b.a.j.m.c": ["Communication", "Content Writing", "Journalism", "Public Relations", "Media Production", "Social Media", "Problem Solving"],

  // Science specializations
  "b.sc physics": ["Physics", "Research", "Laboratory Techniques", "Data Analysis", "Problem Solving"],
  "m.sc physics": ["Physics", "Research", "Laboratory Techniques", "Data Analysis", "Problem Solving"],
  "b.sc chemistry": ["Chemistry", "Laboratory Techniques", "Chemical Analysis", "Problem Solving"],
  "m.sc chemistry": ["Chemistry", "Laboratory Techniques", "Chemical Analysis", "Problem Solving"],
  "b.sc mathematics": ["Mathematics", "Statistics", "Data Analysis", "Research", "Problem Solving"],
  "m.sc mathematics": ["Mathematics", "Statistics", "Data Analysis", "Research", "Problem Solving"],
  "b.sc statistics": ["Statistics", "Data Analysis", "Excel", "Research", "Problem Solving"],
  "m.sc statistics": ["Statistics", "Data Analysis", "Excel", "Research", "Problem Solving"],
  "b.sc microbiology": ["Microbiology", "Laboratory Techniques", "Research", "Problem Solving"],
  "m.sc microbiology": ["Microbiology", "Laboratory Techniques", "Research", "Problem Solving"],
  "b.sc biochemistry": ["Biochemistry", "Laboratory Techniques", "Research", "Problem Solving"],
  "m.sc biochemistry": ["Biochemistry", "Laboratory Techniques", "Research", "Problem Solving"],
  "b.sc zoology": ["Zoology", "Laboratory Techniques", "Research", "Problem Solving"],
  "m.sc zoology": ["Zoology", "Laboratory Techniques", "Research", "Problem Solving"],
  "b.sc botany": ["Botany", "Laboratory Techniques", "Research", "Problem Solving"],
  "m.sc botany": ["Botany", "Laboratory Techniques", "Research", "Problem Solving"],
  "bachelor of science in information technology": ["Python", "Java", "JavaScript", "SQL", "Git", "REST APIs", "Networking", "Technical Support", "Problem Solving"],
  "b.sc it": ["Python", "Java", "JavaScript", "SQL", "Git", "REST APIs", "Networking", "Technical Support", "Problem Solving"],
  "master of science in information technology": ["Python", "Java", "JavaScript", "SQL", "Git", "REST APIs", "Networking", "System Administration", "Problem Solving"],
  "m.sc it": ["Python", "Java", "JavaScript", "SQL", "Git", "REST APIs", "Networking", "System Administration", "Problem Solving"],
  "bachelor of science in computer science": ["Python", "Java", "JavaScript", "SQL", "Git", "Web Development", "REST APIs", "Problem Solving"],
  "b.sc cs": ["Python", "Java", "JavaScript", "SQL", "Git", "Web Development", "REST APIs", "Problem Solving"],
  "master of science in computer science": ["Python", "Java", "JavaScript", "SQL", "Git", "Web Development", "REST APIs", "System Design", "Problem Solving"],
  "m.sc cs": ["Python", "Java", "JavaScript", "SQL", "Git", "Web Development", "REST APIs", "System Design", "Problem Solving"],
  "bachelor of science in cyber security": ["Cybersecurity", "Networking", "Ethical Hacking", "Problem Solving", "Linux"],
  "b.sc cyber security": ["Cybersecurity", "Networking", "Ethical Hacking", "Problem Solving", "Linux"],
  "bachelor of science in data science": ["Data Science", "Python", "Machine Learning", "Statistics", "SQL", "Data Analysis", "Problem Solving"],
  "b.sc data science": ["Data Science", "Python", "Machine Learning", "Statistics", "SQL", "Data Analysis", "Problem Solving"],
  "m.sc data science": ["Data Science", "Python", "Machine Learning", "Statistics", "SQL", "Data Analysis", "Problem Solving"],
  "bachelor of science in artificial intelligence": ["Artificial Intelligence", "Machine Learning", "Python", "Data Science", "Problem Solving"],
  "b.sc ai": ["Artificial Intelligence", "Machine Learning", "Python", "Data Science", "Problem Solving"],
  "m.sc ai": ["Artificial Intelligence", "Machine Learning", "Python", "Data Science", "Problem Solving"],
  "bachelor of science in cloud computing": ["Cloud Computing", "AWS", "Azure", "Docker", "Linux", "Problem Solving"],
  "b.sc cloud computing": ["Cloud Computing", "AWS", "Azure", "Docker", "Linux", "Problem Solving"],

  // General / Fallback catch-alls
  "diploma-general": ["Technical Skills", "Problem Solving", "Communication", "Teamwork"],
  "certificate": ["Basic Skills", "Problem Solving", "Communication"],
  "it-is": ["Technical Skills", "Trade Skills", "Problem Solving", "Safety", "Communication"],
  "12th": ["Communication", "Basic Computer Skills", "Problem Solving", "Customer Service", "Data Entry"],
  "10th": ["Communication", "Basic Computer Skills", "Problem Solving", "Customer Service", "Data Entry"],
  "any graduate": ["Communication", "Problem Solving", "Teamwork", "Excel", "Data Entry", "Customer Service", "Basic Computer Skills"],
  "graduate": ["Communication", "Problem Solving", "Teamwork", "Excel", "Data Entry", "Customer Service", "Basic Computer Skills"],
  "post graduate": ["Communication", "Problem Solving", "Teamwork", "Excel", "Data Entry", "Customer Service", "Basic Computer Skills"],
  "12th pass": ["Communication", "Basic Computer Skills", "Problem Solving", "Customer Service", "Data Entry"],
  "higher secondary": ["Communication", "Basic Computer Skills", "Problem Solving", "Customer Service", "Data Entry"],
  "10th pass": ["Communication", "Basic Computer Skills", "Problem Solving", "Customer Service", "Data Entry"],
};

const SKILLS: SkillDefinition[] = [
  // Automotive / mechanical
  { name: "Automotive Engineering", category: "Automotive", aliases: ["automotive engineering", "automobile engineering", "automotive technology"] },
  { name: "Vehicle Dynamics", category: "Automotive", aliases: ["vehicle dynamics", "ride and handling", "suspension design"] },
  { name: "Powertrain", category: "Automotive", aliases: ["powertrain", "power train", "drivetrain", "driveline"] },
  { name: "IC Engines", category: "Automotive", aliases: ["ic engine", "ic engines", "internal combustion", "engine calibration", "engine design"] },
  { name: "EV Technology", category: "Automotive", aliases: ["electric vehicle", "electric vehicles", "ev technology", "battery management system", "bms", "ev powertrain", "charging infrastructure"] },
  { name: "Battery Systems", category: "Automotive", aliases: ["battery systems", "battery pack", "battery design", "cell chemistry", "lithium-ion"] },
  { name: "CAD", category: "Design", aliases: ["cad", "computer aided design", "computer-aided design"] },
  { name: "SolidWorks", category: "Design", aliases: ["solidworks", "solid works"] },
  { name: "CATIA", category: "Design", aliases: ["catia"] },
  { name: "AutoCAD", category: "Design", aliases: ["autocad", "auto cad"] },
  { name: "Creo", category: "Design", aliases: ["creo", "pro/engineer", "pro engineer"] },
  { name: "NX", category: "Design", aliases: ["siemens nx", "unigraphics"] },
  { name: "GD&T", category: "Design", aliases: ["gd&t", "gd and t", "geometric dimensioning", "geometric tolerancing"] },
  { name: "FEA", category: "Design", aliases: ["fea", "finite element analysis", "structural analysis"] },
  { name: "CFD", category: "Design", aliases: ["cfd", "computational fluid dynamics"] },
  { name: "MATLAB", category: "Engineering Tools", aliases: ["matlab"] },
  { name: "Simulink", category: "Engineering Tools", aliases: ["simulink"] },
  { name: "ANSYS", category: "Engineering Tools", aliases: ["ansys"] },
  { name: "Abaqus", category: "Engineering Tools", aliases: ["abaqus"] },
  { name: "Manufacturing", category: "Manufacturing", aliases: ["manufacturing", "manufacturing engineering", "production engineering"] },
  { name: "Production Planning", category: "Manufacturing", aliases: ["production planning", "production scheduling", "shop floor", "line balancing"] },
  { name: "Quality Control", category: "Quality", aliases: ["quality control", "quality assurance", "qa/qc", "qc", "inspection", "quality engineering"] },
  { name: "Six Sigma", category: "Quality", aliases: ["six sigma", "dmaic"] },
  { name: "Lean Manufacturing", category: "Manufacturing", aliases: ["lean manufacturing", "lean", "kaizen", "5s", "value stream mapping"] },
  { name: "ISO Standards", category: "Quality", aliases: ["iso 9001", "iatf 16949", "iso/ts", "iso standards", "iso 14001"] },
  { name: "Maintenance", category: "Manufacturing", aliases: ["preventive maintenance", "predictive maintenance", "maintenance engineering", "tpm"] },
  { name: "Supply Chain", category: "Operations", aliases: ["supply chain", "supply-chain", "supply planning"] },
  { name: "Procurement", category: "Operations", aliases: ["procurement", "purchasing", "sourcing", "vendor management"] },
  { name: "Logistics", category: "Operations", aliases: ["logistics", "warehouse", "inventory management", "distribution"] },
  { name: "Project Management", category: "Business", aliases: ["project management", "project coordination", "program management", "pmp", "stakeholder management"] },
  { name: "Operations", category: "Operations", aliases: ["business operations", "operations management", "operations executive", "process improvement"] },
  { name: "PLC", category: "Automation", aliases: ["plc", "programmable logic controller", "ladder logic"] },
  { name: "SCADA", category: "Automation", aliases: ["scada", "hmi"] },
  { name: "Robotics", category: "Automation", aliases: ["robotics", "robot programming", "cobot"] },
  { name: "Embedded Systems", category: "Automation", aliases: ["embedded systems", "embedded c", "microcontroller", "arduino", "raspberry pi"] },
  { name: "IoT", category: "Automation", aliases: ["internet of things", "iot"] },
  { name: "Mechatronics", category: "Automation", aliases: ["mechatronics"] },
  { name: "Python", category: "Programming", aliases: ["python"] },
  { name: "Java", category: "Programming", aliases: ["java"] },
  { name: "JavaScript", category: "Programming", aliases: ["javascript", "js"] },
  { name: "TypeScript", category: "Programming", aliases: ["typescript"] },
  { name: "C++", category: "Programming", aliases: ["c++", "cpp"] },
  { name: "C#", category: "Programming", aliases: ["c#", ".net"] },
  { name: "Go", category: "Programming", aliases: ["golang"] },
  { name: "React", category: "Web", aliases: ["react", "react.js", "reactjs"] },
  { name: "Next.js", category: "Web", aliases: ["next.js", "nextjs"] },
  { name: "Node.js", category: "Web", aliases: ["node.js", "nodejs", "node js"] },
  { name: "HTML", category: "Web", aliases: ["html", "html5"] },
  { name: "CSS", category: "Web", aliases: ["css", "css3", "tailwind"] },
  { name: "REST APIs", category: "Web", aliases: ["rest api", "restful", "rest apis", "api development"] },
  { name: "SQL", category: "Data", aliases: ["sql", "mysql", "postgresql", "postgres"] },
  { name: "NoSQL", category: "Data", aliases: ["mongodb", "nosql", "redis"] },
  { name: "Excel", category: "Data", aliases: ["excel", "advanced excel", "spreadsheets", "vlookup", "pivot tables"] },
  { name: "Power BI", category: "Data", aliases: ["power bi", "powerbi"] },
  { name: "Tableau", category: "Data", aliases: ["tableau"] },
  { name: "Data Analysis", category: "Data", aliases: ["data analysis", "data analytics", "analytical skills", "data-driven", "data driven"] },
  { name: "Data Visualization", category: "Data", aliases: ["data visualization", "data visualisation", "dashboarding", "dashboards"] },
  { name: "Machine Learning", category: "Data", aliases: ["machine learning", "ml models", "deep learning", "scikit-learn", "tensorflow", "pytorch"] },
  { name: "Statistics", category: "Data", aliases: ["statistics", "statistical analysis", "regression analysis", "hypothesis testing"] },
  { name: "Git", category: "Engineering Tools", aliases: ["git", "github", "gitlab", "version control"] },
  { name: "Linux", category: "IT", aliases: ["linux", "unix", "bash", "shell scripting"] },
  { name: "AWS", category: "Cloud", aliases: ["aws", "amazon web services"] },
  { name: "Azure", category: "Cloud", aliases: ["azure"] },
  { name: "GCP", category: "Cloud", aliases: ["gcp", "google cloud"] },
  { name: "Docker", category: "Cloud", aliases: ["docker", "containerization", "kubernetes"] },
  { name: "Manual Testing", category: "Quality", aliases: ["manual testing", "test cases", "functional testing", "regression testing"] },
  { name: "Automation Testing", category: "Quality", aliases: ["automation testing", "selenium", "cypress", "playwright", "test automation"] },
  { name: "QA Engineering", category: "Quality", aliases: ["qa engineer", "quality assurance engineer", "sdet", "software tester"] },
  { name: "Technical Support", category: "Support", aliases: ["technical support", "troubleshooting", "application support", "production support", "desktop support"] },
  { name: "Networking", category: "IT", aliases: ["networking", "tcp/ip", "dns", "ccna", "network administration"] },
  { name: "System Administration", category: "IT", aliases: ["system administration", "sysadmin", "active directory", "windows server"] },
  { name: "Cybersecurity", category: "IT", aliases: ["cybersecurity", "information security", "penetration testing", "soc"] },
  { name: "Product Management", category: "Business", aliases: ["product management", "product owner", "product roadmap"] },
  { name: "Business Analysis", category: "Business", aliases: ["business analysis", "business analyst", "requirements gathering", "brd", "functional requirements"] },
  { name: "Business Development", category: "Sales", aliases: ["business development", "lead generation", "b2b sales", "prospecting"] },
  { name: "Sales", category: "Sales", aliases: ["sales", "inside sales", "field sales", "sales executive", "revenue targets"] },
  { name: "Customer Success", category: "Support", aliases: ["customer success", "client relationship", "account management", "customer retention"] },
  { name: "Customer Support", category: "Support", aliases: ["customer support", "customer service", "chat support", "email support", "voice process", "non-voice", "customer care"] },
  { name: "Communication", category: "Soft Skills", aliases: ["communication skills", "verbal communication", "written communication", "presentation skills", "stakeholder communication"] },
  { name: "Problem Solving", category: "Soft Skills", aliases: ["problem solving", "problem-solving", "root cause analysis", "rca", "critical thinking"] },
  { name: "Teamwork", category: "Soft Skills", aliases: ["teamwork", "team player", "collaboration", "cross-functional"] },
  { name: "Leadership", category: "Soft Skills", aliases: ["leadership", "team handling", "people management", "mentoring"] },
  { name: "Negotiation", category: "Soft Skills", aliases: ["negotiation", "negotiating"] },
  { name: "Time Management", category: "Soft Skills", aliases: ["time management", "prioritization", "multitasking"] },
  { name: "Attention to Detail", category: "Soft Skills", aliases: ["attention to detail", "detail-oriented", "detail oriented", "accuracy"] },
  { name: "CRM", category: "Sales", aliases: ["crm", "salesforce crm", "zoho crm", "hubspot"] },
  { name: "Accounting", category: "Finance", aliases: ["accounting", "bookkeeping", "general ledger", "reconciliation", "accounts payable", "accounts receivable"] },
  { name: "Tally", category: "Finance", aliases: ["tally", "tally erp"] },
  { name: "Financial Analysis", category: "Finance", aliases: ["financial analysis", "financial modeling", "budgeting", "forecasting", "variance analysis"] },
  { name: "Banking Operations", category: "Finance", aliases: ["banking operations", "kyc", "aml", "loan processing", "credit analysis"] },
  { name: "MIS Reporting", category: "Finance", aliases: ["mis", "mis reporting", "management information system", "reporting analyst"] },
  { name: "Payroll", category: "HR", aliases: ["payroll", "salary processing", "statutory compliance"] },
  { name: "Recruitment", category: "HR", aliases: ["recruitment", "talent acquisition", "sourcing candidates", "hr operations"] },
  { name: "Digital Marketing", category: "Marketing", aliases: ["digital marketing", "performance marketing", "paid campaigns", "google ads", "meta ads"] },
  { name: "SEO", category: "Marketing", aliases: ["seo", "search engine optimization"] },
  { name: "Social Media Marketing", category: "Marketing", aliases: ["social media marketing", "smm", "social media"] },
  { name: "Content Writing", category: "Marketing", aliases: ["content writing", "copywriting", "content creation"] },
  { name: "Graphic Design", category: "Design", aliases: ["graphic design", "visual design"] },
  { name: "UI Design", category: "Design", aliases: ["ui design", "user interface design"] },
  { name: "UX Design", category: "Design", aliases: ["ux design", "user experience design"] },
  { name: "Figma", category: "Design", aliases: ["figma"] },
  { name: "Video Editing", category: "Marketing", aliases: ["video editing", "video production"] },
];

const SKILL_ALIAS_INDEX = new Map<string, SkillDefinition>();
for (const skill of SKILLS) {
  SKILL_ALIAS_INDEX.set(skill.name.toLowerCase(), skill);
  for (const alias of skill.aliases) SKILL_ALIAS_INDEX.set(alias.toLowerCase(), skill);
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function canonicalSkill(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  const hit = SKILL_ALIAS_INDEX.get(cleaned.toLowerCase());
  if (hit) return hit.name;
  const lower = cleaned.toLowerCase();
  for (const skill of SKILLS) {
    if (skill.aliases.some((a) => a.length > 3 && lower.includes(a))) return skill.name;
  }
  return cleaned
    .split(" ")
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export function skillCategory(name: string): string {
  return SKILL_ALIAS_INDEX.get(name.toLowerCase())?.category ?? "Other";
}

export function extractSkills(text: string, limit = 30): string[] {
  const haystack = text.toLowerCase();
  const found = new Map<string, number>();
  for (const skill of SKILLS) {
    for (const alias of skill.aliases) {
      if (alias.length < 2) continue;
      const re = new RegExp(`(^|[^a-z0-9+#.])${escapeRegex(alias.toLowerCase())}([^^a-z0-9+#.]|$)`, "g");
      const matches = haystack.match(re);
      if (matches) found.set(skill.name, (found.get(skill.name) ?? 0) + matches.length);
    }
  }
  return [...found.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}

export function getDegreeSkills(degree: string): string[] {
  if (!degree) return [];
  const key = degree.trim().toLowerCase();
  if (DEGREE_SKILLS[key]) return DEGREE_SKILLS[key];
  const words = key.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const matched = Object.entries(DEGREE_SKILLS).filter(([degreeKey]) =>
    words.every((w) => degreeKey.includes(w))
  );
  if (matched.length > 0) {
    const allSkills = new Set<string>();
    for (const [, skills] of matched) {
      for (const s of skills) allSkills.add(s);
    }
    return [...allSkills].slice(0, 20);
  }
  const partial = Object.entries(DEGREE_SKILLS).filter(([degreeKey]) =>
    words.some((w) => degreeKey.includes(w))
  );
  if (partial.length > 0) {
    const allSkills = new Set<string>();
    for (const [, skills] of partial) {
      for (const s of skills) allSkills.add(s);
    }
    return [...allSkills].slice(0, 20);
  }
  return [];
}

export interface RoleFamily {
  key: string;
  label: string;
  titles: RegExp[];
  coreSkills: string[];
  adjacentSkills: string[];
  education: "engineering" | "any" | "commerce" | "it" | "design";
  industries: string[];
  description: string;
}

export const ROLE_FAMILIES: RoleFamily[] = [
  {
    key: "automotive",
    label: "Automotive & EV Engineering",
    titles: [/automobile/i, /automotive/i, /vehicle/i, /powertrain/i, /chassis/i, /engine/i, /ev\b/i, /battery/i, /homologation/i, /workshop/i, /body shop/i, /paint shop/i],
    coreSkills: ["Automotive Engineering", "Vehicle Dynamics", "Powertrain", "IC Engines", "EV Technology", "Battery Systems", "CAD", "SolidWorks", "CATIA"],
    adjacentSkills: ["Manufacturing", "Quality Control", "Project Management", "Data Analysis"],
    education: "engineering",
    industries: ["Automotive", "Manufacturing", "EV", "Mobility"],
    description: "Design, test, manufacture and service vehicles, components and EV systems.",
  },
  {
    key: "mechanical_design",
    label: "Mechanical Design & CAE",
    titles: [/mechanical/i, /design engineer/i, /cad engineer/i, /cae/i, /simulation/i, /thermal/i, /structural/i, /product design/i, /tool design/i, /r&d/i, /research and development/i],
    coreSkills: ["CAD", "SolidWorks", "CATIA", "Creo", "NX", "GD&T", "FEA", "CFD", "ANSYS", "Abaqus", "MATLAB"],
    adjacentSkills: ["Manufacturing", "Project Management", "Automotive Engineering"],
    education: "engineering",
    industries: ["Automotive", "Manufacturing", "Aerospace", "Industrial Equipment"],
    description: "Turn concepts into manufacturable products using CAD, simulation and design validation.",
  },
  {
    key: "manufacturing_quality",
    label: "Manufacturing, Quality & Operations Engineering",
    titles: [/manufactur/i, /production/i, /quality/i, /maintenance/i, /plant/i, /process engineer/i, /industrial engineer/i, /supplier quality/i, /lean/i, /six sigma/i, /operations engineer/i, /safety/i],
    coreSkills: ["Manufacturing", "Production Planning", "Quality Control", "Six Sigma", "Lean Manufacturing", "ISO Standards", "Maintenance", "GD&T", "PLC", "Project Management"],
    adjacentSkills: ["Supply Chain", "Operations", "Data Analysis", "Problem Solving"],
    education: "engineering",
    industries: ["Automotive", "Manufacturing", "FMCG", "Pharma", "Electronics"],
    description: "Improve production lines, quality systems, reliability and plant performance.",
  },
  {
    key: "field_service",
    label: "Field Service & Technical Support",
    titles: [/service engineer/i, /field engineer/i, /technical support/i, /installation/i, /commissioning/i, /after[- ]sales/i, /service desk/i, /application engineer/i, /customer engineer/i],
    coreSkills: ["Technical Support", "Problem Solving", "Communication", "Maintenance", "Automotive Engineering", "Networking"],
    adjacentSkills: ["Customer Support", "Customer Success", "Operations", "Sales"],
    education: "engineering",
    industries: ["Automotive", "Industrial Equipment", "IT", "Telecom", "Energy"],
    description: "Diagnose, install and support technical products for customers in the field or remotely.",
  },
  {
    key: "software",
    label: "Software Engineering & QA",
    titles: [/software/i, /developer/i, /frontend/i, /front-end/i, /backend/i, /back-end/i, /full[- ]stack/i, /web developer/i, /qa engineer/i, /sdet/i, /software tester/i, /devops/i, /data engineer/i, /machine learning engineer/i, /ai engineer/i],
    coreSkills: ["Python", "Java", "JavaScript", "TypeScript", "React", "Node.js", "SQL", "Git", "REST APIs", "Docker", "AWS", "Automation Testing", "Manual Testing"],
    adjacentSkills: ["Data Analysis", "Problem Solving", "Technical Support", "Product Management"],
    education: "it",
    industries: ["IT", "SaaS", "FinTech", "E-commerce", "Startups"],
    description: "Build, test and operate software products and platforms.",
  },
  {
    key: "data_business_analyst",
    label: "Data & Business Analysis",
    titles: [/data analyst/i, /business analyst/i, /business intelligence/i, /\bbi\b/i, /analytics/i, /mis executive/i, /data science/i, /product analyst/i, /reporting analyst/i, /insights/i],
    coreSkills: ["SQL", "Excel", "Power BI", "Tableau", "Data Analysis", "Data Visualization", "Statistics", "Python", "MIS Reporting", "Business Analysis"],
    adjacentSkills: ["Communication", "Problem Solving", "Operations", "Project Management"],
    education: "any",
    industries: ["IT", "BFSI", "E-commerce", "Consulting", "Manufacturing"],
    description: "Use data, dashboards and analysis to inform business decisions.",
  },
  {
    key: "business_operations",
    label: "Business, Sales & Operations",
    titles: [/business development/i, /sales/i, /account executive/i, /account manager/i, /customer success/i, /operations/i, /management trainee/i, /project coordinator/i, /procurement/i, /supply chain/i, /logistics/i, /process associate/i, /founder'?s office/i, /generalist/i, /strategy/i, /partnerships/i],
    coreSkills: ["Business Development", "Sales", "Operations", "Communication", "Negotiation", "Customer Success", "Supply Chain", "Procurement", "Project Management", "CRM", "Excel"],
    adjacentSkills: ["Business Analysis", "Data Analysis", "Marketing", "Leadership"],
    education: "any",
    industries: ["E-commerce", "Logistics", "Manufacturing", "SaaS", "FinTech", "Retail"],
    description: "Grow revenue, run operations and solve customer or process problems.",
  },
  {
    key: "customer_support",
    label: "Customer & Technical Support",
    titles: [/customer support/i, /customer service/i, /voice process/i, /non[- ]voice/i, /chat support/i, /email support/i, /service desk/i, /customer care/i, /support associate/i, /support executive/i, /customer experience/i],
    coreSkills: ["Customer Support", "Communication", "Problem Solving", "Technical Support", "CRM", "Attention to Detail"],
    adjacentSkills: ["Customer Success", "Operations", "Sales"],
    education: "any",
    industries: ["BPO", "IT", "E-commerce", "BFSI", "Telecom"],
    description: "Resolve customer issues across voice, chat and email channels.",
  },
  {
    key: "finance_admin",
    label: "Finance, HR & Administration",
    titles: [/finance/i, /account/i, /banking operations/i, /payroll/i, /recruit/i, /talent acquisition/i, /hr assistant/i, /human resource/i, /back office/i, /data entry/i, /office assistant/i, /administration/i, /audit/i, /tax/i],
    coreSkills: ["Accounting", "Excel", "Tally", "Financial Analysis", "Banking Operations", "MIS Reporting", "Payroll", "Recruitment", "Attention to Detail"],
    adjacentSkills: ["Data Analysis", "Operations", "Communication", "Business Analysis"],
    education: "commerce",
    industries: ["BFSI", "Consulting", "Manufacturing", "IT"],
    description: "Keep financial, people and administrative operations accurate and compliant.",
  },
  {
    key: "marketing_creative",
    label: "Marketing & Creative",
    titles: [/marketing/i, /seo/i, /social media/i, /content/i, /copywriter/i, /graphic design/i, /video edit/i, /brand/i, /performance marketing/i, /growth/i, /communications/i],
    coreSkills: ["Digital Marketing", "SEO", "Social Media Marketing", "Content Writing", "Graphic Design", "Video Editing", "Figma", "Market Research", "Data Analysis"],
    adjacentSkills: ["Communication", "Business Development", "Product Management"],
    education: "design",
    industries: ["Marketing", "E-commerce", "Media", "SaaS", "Startups"],
    description: "Create demand, content and brand experiences across digital channels.",
  },
  {
    key: "graduate_trainee",
    label: "Graduate Trainee & Apprenticeship Programs",
    titles: [/graduate engineer trainee/i, /\bget\b/i, /management trainee/i, /trainee/i, /apprentice/i, /intern(ship)?\b/i, /fresher/i, /graduate program/i, /campus/i],
    coreSkills: ["Communication", "Problem Solving", "Teamwork", "Excel", "Project Management"],
    adjacentSkills: ["Automotive Engineering", "Manufacturing", "Data Analysis", "Operations", "Software"],
    education: "any",
    industries: ["Automotive", "Manufacturing", "IT", "Consulting", "FMCG"],
    description: "Structured entry-level programs that rotate across functions and build broad capability.",
  },
];

export function classifyRole(title: string, description = ""): RoleFamily {
  const haystack = `${title} ${title} ${description.slice(0, 1200)}`;
  let best = ROLE_FAMILIES.find((r) => r.key === "graduate_trainee")!;
  let bestScore = 0;
  for (const family of ROLE_FAMILIES) {
    let score = 0;
    for (const re of family.titles) {
      const matches = haystack.match(new RegExp(re.source, "gi"));
      if (matches) score += matches.length * (title.match(re) ? 5 : 1);
    }
    if (score > bestScore) {
      best = family;
      bestScore = score;
    }
  }
  if (bestScore === 0) {
    if (/senior|staff|principal|lead/i.test(title)) {
      return ROLE_FAMILIES.find((r) => r.key === "business_operations")!;
    }
    return ROLE_FAMILIES.find((r) => r.key === "graduate_trainee")!;
  }
  return best;
}

export const TRANSFERABLE: Record<string, string[]> = {
  "Automotive Engineering": ["Mechanical Design & CAE", "Manufacturing, Quality & Operations Engineering", "Field Service & Technical Support"],
};

export const CAREER_PATH_KEYWORDS: Record<string, string[]> = {
  "Automotive & EV Engineering": ["automobile", "automotive", "ev", "vehicle", "powertrain", "battery", "engine", "homologation"],
  "Mechanical Design & CAE": ["mechanical", "design", "cad", "cae", "simulation", "thermal", "r&d"],
  "Manufacturing, Quality & Operations Engineering": ["manufacturing", "production", "quality", "maintenance", "plant", "process", "industrial", "lean", "six sigma"],
  "Field Service & Technical Support": ["service engineer", "field engineer", "technical support", "installation", "commissioning", "application engineer"],
  "Software Engineering & QA": ["software", "developer", "frontend", "backend", "full stack", "qa", "tester", "data engineer", "devops"],
  "Data & Business Analysis": ["data analyst", "business analyst", "bi", "analytics", "mis", "reporting", "insights"],
  "Business, Sales & Operations": ["business development", "sales", "operations", "management trainee", "customer success", "supply chain", "logistics", "procurement", "generalist", "founder's office"],
  "Customer & Technical Support": ["customer support", "customer service", "voice process", "chat support", "service desk", "support executive"],
  "Finance, HR & Administration": ["finance", "accounts", "banking operations", "payroll", "recruitment", "hr", "back office", "data entry", "audit"],
  "Marketing & Creative": ["marketing", "seo", "social media", "content", "graphic design", "video editor", "brand", "growth"],
  "Graduate Trainee & Apprenticeship Programs": ["graduate engineer trainee", "get", "trainee", "apprentice", "intern", "fresher", "graduate program"],
};

export function skillsForProfile(profile: Pick<CandidateProfile, "skills">): Set<string> {
  return new Set(profile.skills.map((s) => canonicalSkill(s.name)));
}

export function candidateRoleFamilies(profile: CandidateProfile, prefs?: CandidatePreferences): Set<string> {
  const families = new Set<string>();
  const hay = [
    ...profile.skills.map((s) => s.name),
    profile.degree,
    profile.headline,
    ...(prefs?.targetRoles ?? []),
    ...(prefs?.industries ?? []),
  ].join(" ");
  for (const family of ROLE_FAMILIES) {
    const keywords = CAREER_PATH_KEYWORDS[family.label] ?? [];
    if (keywords.some((k) => hay.toLowerCase().includes(k))) families.add(family.label);
  }
  if (families.size === 0) {
    families.add("Graduate Trainee & Apprenticeship Programs");
    families.add("Business, Sales & Operations");
  }
  return families;
}

export const BROAD_JOB_CATEGORIES: { label: string; roles: string[] }[] = [
  { label: "Engineering & technical", roles: ["Automobile Engineer", "Mechanical Engineer", "Graduate Engineer Trainee", "Production Engineer", "Quality Engineer", "Maintenance Engineer", "Design / CAD Engineer", "Manufacturing Engineer", "Service Engineer", "Technical Support Engineer", "Field Engineer", "Robotics", "Industrial Engineering"] },
  { label: "IT & software", roles: ["Software Developer", "Frontend Developer", "Backend Developer", "Full Stack Developer", "QA Engineer", "Software Tester", "IT Support", "System Administrator", "Data Analyst", "BI Analyst", "Junior Data Engineer", "AI/ML Intern", "Product Support"] },
  { label: "Business & corporate", roles: ["Business Analyst", "Operations Executive", "Business Development Executive", "Sales Executive", "Customer Success Associate", "Account Executive", "Process Associate", "Management Trainee", "Project Coordinator", "Procurement Executive", "Supply Chain Associate", "Logistics Executive"] },
  { label: "Customer support", roles: ["Customer Support Executive", "Technical Support Associate", "Customer Success Associate", "Chat Support", "Email Support", "International Voice Process", "Service Desk Analyst"] },
  { label: "Finance & administration", roles: ["Finance Associate", "Banking Operations", "Accounts Assistant", "MIS Executive", "Back Office Executive", "HR Assistant", "Recruitment Coordinator", "Payroll Assistant"] },
  { label: "Marketing & creative", roles: ["Digital Marketing Executive", "SEO Executive", "Social Media Executive", "Content Writer", "Marketing Associate", "Graphic Design Assistant", "Video Editor"] },
  { label: "Other sectors", roles: ["E-commerce", "Retail", "Hospitality", "Healthcare administration", "Education", "EdTech", "FinTech", "Logistics", "Renewable energy", "Insurance", "Telecom", "Government opportunities", "Apprenticeships", "Graduate programs", "Startup generalist"] },
];

export const SKILL_BRIDGES: Record<string, string[]> = {
  CAD: ["SolidWorks", "CATIA", "AutoCAD", "Creo", "NX", "GD&T", "FEA", "CFD"],
  SolidWorks: ["CAD", "CATIA", "Creo", "NX", "GD&T"],
  CATIA: ["CAD", "SolidWorks", "Creo", "NX", "GD&T"],
  AutoCAD: ["CAD", "SolidWorks", "CATIA"],
  FEA: ["ANSYS", "Abaqus", "CAD", "CFD"],
  CFD: ["FEA", "ANSYS", "CAD"],
  Manufacturing: ["Production Planning", "Lean Manufacturing", "Six Sigma", "Quality Control", "Maintenance"],
  "Production Planning": ["Manufacturing", "Lean Manufacturing", "Supply Chain"],
  "Quality Control": ["ISO Standards", "Six Sigma", "GD&T", "Manufacturing"],
  "Six Sigma": ["Quality Control", "Lean Manufacturing", "Manufacturing"],
  "Lean Manufacturing": ["Six Sigma", "Quality Control", "Production Planning"],
  Maintenance: ["Manufacturing", "PLC", "Robotics"],
  "Supply Chain": ["Logistics", "Procurement", "Operations", "Production Planning"],
  Procurement: ["Supply Chain", "Logistics", "Negotiation"],
  Logistics: ["Supply Chain", "Operations", "Procurement"],
  "Project Management": ["Operations", "Supply Chain", "Business Analysis"],
  Operations: ["Supply Chain", "Logistics", "Project Management", "Customer Support"],
  PLC: ["SCADA", "Robotics", "Maintenance", "Embedded Systems"],
  SCADA: ["PLC", "Robotics", "IoT"],
  Robotics: ["PLC", "SCADA", "Mechatronics", "Embedded Systems"],
  "Embedded Systems": ["IoT", "PLC", "Robotics"],
  "Automotive Engineering": ["Vehicle Dynamics", "Powertrain", "IC Engines", "EV Technology", "CAD"],
  "EV Technology": ["Battery Systems", "Automotive Engineering", "Powertrain"],
  Powertrain: ["Automotive Engineering", "IC Engines", "EV Technology", "Vehicle Dynamics"],
  "Vehicle Dynamics": ["Automotive Engineering", "Powertrain", "CAD"],
  Excel: ["Data Analysis", "Power BI", "Tableau", "MIS Reporting", "Accounting"],
  "Data Analysis": ["Power BI", "Tableau", "Statistics", "SQL", "Excel", "Data Visualization"],
  SQL: ["Data Analysis", "Data Visualization", "NoSQL"],
  Python: ["Data Analysis", "Machine Learning", "Automation Testing", "Statistics"],
  "Power BI": ["Tableau", "Data Visualization", "Excel", "Data Analysis"],
  Tableau: ["Power BI", "Data Visualization", "Excel", "Data Analysis"],
  "Data Visualization": ["Power BI", "Tableau", "Data Analysis"],
  "Machine Learning": ["Python", "Statistics", "Data Analysis"],
  "Business Analysis": ["Data Analysis", "Project Management", "Operations", "MIS Reporting"],
  "Technical Support": ["Customer Support", "Networking", "System Administration", "Problem Solving"],
  "Customer Support": ["Customer Success", "Communication", "CRM"],
  "Customer Success": ["Customer Support", "CRM", "Business Development"],
  Sales: ["Business Development", "CRM", "Negotiation", "Communication"],
  "Business Development": ["Sales", "CRM", "Market Research", "Negotiation"],
  CRM: ["Sales", "Customer Success", "Business Development"],
  "Digital Marketing": ["SEO", "Social Media Marketing", "Content Writing", "Market Research"],
  SEO: ["Digital Marketing", "Content Writing", "Market Research"],
  "Social Media Marketing": ["Digital Marketing", "Content Writing", "Graphic Design"],
  "Content Writing": ["SEO", "Digital Marketing", "Communication"],
  Accounting: ["Tally", "Financial Analysis", "Excel", "MIS Reporting"],
  Tally: ["Accounting", "Financial Analysis"],
  "Financial Analysis": ["Accounting", "Excel", "Data Analysis"],
  "Banking Operations": ["Financial Analysis", "Accounting", "Attention to Detail"],
  "MIS Reporting": ["Excel", "Data Analysis", "Power BI"],
  Payroll: ["Accounting", "Excel", "Attention to Detail"],
  Recruitment: ["Communication", "Payroll", "CRM"],
  "Manual Testing": ["Automation Testing", "QA Engineering", "Attention to Detail"],
  "Automation Testing": ["Manual Testing", "QA Engineering", "Python", "JavaScript"],
  "QA Engineering": ["Manual Testing", "Automation Testing", "Problem Solving"],
  React: ["JavaScript", "TypeScript", "HTML", "CSS", "Next.js"],
  "Node.js": ["JavaScript", "TypeScript", "REST APIs", "SQL"],
  JavaScript: ["TypeScript", "React", "Node.js", "HTML", "CSS"],
  TypeScript: ["JavaScript", "React", "Node.js"],
  "REST APIs": ["Node.js", "SQL", "Technical Support"],
  Docker: ["Linux", "AWS", "Azure", "GCP"],
  AWS: ["Azure", "GCP", "Docker", "Linux"],
  Linux: ["Docker", "Networking", "System Administration"],
  Networking: ["System Administration", "Technical Support", "Cybersecurity"],
  Communication: ["Customer Support", "Sales", "Negotiation", "Content Writing"],
  "Problem Solving": ["Data Analysis", "Technical Support", "Quality Control"],
};

