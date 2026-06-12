import CollabEditor from '@/components/collab/collab-editor';
import CollabAV from '@/components/collab/collab-av';
import CollabTerminal from '@/components/collab/collab-terminal';

export default function RoomPage() { 
  return (
    <div>
      Room
      <CollabEditor />
      <CollabAV />
      <CollabTerminal />
    </div>
  ); 
}
