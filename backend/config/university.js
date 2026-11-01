/**
 * University profile shown in the UI and used by the seed data.
 * Source: https://iubat.edu (engineering programs only).
 */
module.exports = Object.freeze({
  name: 'International University of Business Agriculture and Technology',
  shortName: 'IUBAT',
  website: 'https://iubat.edu',
  emailDomain: 'iubat.edu',
  address: '4 Embankment Drive Road, Sector-10 (Off Dhaka-Ashulia Road), Uttara Model Town, Dhaka-1230, Bangladesh',
  phone: '55091801-5',
  // Approximate campus centre (Uttara Sector-10); used as the default map position.
  location: { lat: 23.8888, lng: 90.3906 },
  departments: [
    { code: 'CSE', name: 'Computer Science and Engineering', programs: ['BCSE', 'DCSE'], url: 'http://cse.iubat.edu' },
    { code: 'EEE', name: 'Electrical and Electronic Engineering', programs: ['BSEEE'], url: 'http://eee.iubat.edu' },
    { code: 'CE', name: 'Civil Engineering', programs: ['BSCE'], url: 'http://ce.iubat.edu' },
    { code: 'ME', name: 'Mechanical Engineering', programs: ['BSME'], url: 'http://me.iubat.edu' },
  ],
});
