import RoomDetail from '@/components/RoomDetail'

type RoomPageProps = {
  params: {
    id: string
  }
}

export default function RoomPage({ params }: RoomPageProps) {
  return <RoomDetail roomId={params.id} />
}
