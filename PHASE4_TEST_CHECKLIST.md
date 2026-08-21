# Nakna HR V1.0-P4 Test Checklist

## Deploy
- [ ] `npm run check` passes
- [ ] D1 migration 0013 applies
- [ ] D1 migration 0014 applies
- [ ] `/api/health` shows `1.0-P4`
- [ ] `/api/bootstrap` shows learning/performance ready

## Course Builder
- [ ] Create a course
- [ ] Add Text module
- [ ] Add Video module and upload to Google Drive
- [ ] Add Document module and upload to Google Drive
- [ ] Add Quiz module
- [ ] Add at least 2 quiz questions
- [ ] Assign course to probation employees
- [ ] Course shows assignment count
- [ ] Employee with LINE receives new-learning card

## Employee Learning Portal
- [ ] Type `เรียนรู้` in LINE
- [ ] Tap `Learning Portal`
- [ ] Course list opens without Google login
- [ ] Video streams from Drive through Nakna
- [ ] Watch video to the end → module becomes completed
- [ ] Text/document can be marked completed
- [ ] Submit wrong quiz → not passed
- [ ] Submit correct quiz → passed
- [ ] Course reaches 100% when all required modules complete

## KPI
- [ ] Create monthly/quarterly cycle
- [ ] Create KPI for employee
- [ ] Set update frequency daily/weekly/monthly
- [ ] Employee opens Portal from LINE
- [ ] Employee updates actual value
- [ ] Progress % calculates from target
- [ ] HR dashboard sees latest progress

## 1:1
- [ ] Schedule 1:1
- [ ] Save manager notes
- [ ] Save action items
- [ ] Save next follow-up
- [ ] Timeline displays the meeting

## Probation
- [ ] Probation employee appears in review list
- [ ] Save submitted review
- [ ] Pass review → employee becomes `employee`
- [ ] Extend review → probation_end_date changes
- [ ] Previous review remains in history

## Google Sheet
- [ ] Sync Workspace
- [ ] Learning Courses tab exists
- [ ] Learning Assignments tab exists
- [ ] KPI Goals tab exists
- [ ] KPI Updates tab exists
- [ ] One on Ones tab exists
- [ ] Probation Reviews tab exists
